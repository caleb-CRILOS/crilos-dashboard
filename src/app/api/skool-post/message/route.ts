import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mutateDb } from "@/lib/dbWrite";
import { isRunning, startTurn, withResolvedRunState } from "@/lib/agentJobs";
import { SkoolPostSession, OnboardingSession } from "@/lib/types";
import {
  buildEchoSystemPrompt,
  buildQuillDraftSystemPrompt,
  buildQuillSystemPrompt,
  DRAFT_REQUESTED_SENTINEL,
  POST_COMPLETE_SENTINEL,
} from "@/lib/skoolPost/prompts";
import { skoolPostSchema } from "@/lib/skoolPost/schemas";
import { extractStructured, sendTurn } from "@/lib/claude-cli";
import { pickDefaultOnboardingSession } from "@/lib/agentContext";
import { logActivity } from "@/lib/activityLog";

const KICKOFF_MESSAGE = "Begin the conversation now, following your instructions.";

type ClientContext = Parameters<typeof buildQuillSystemPrompt>[0];

function newSession(onboardingSession: OnboardingSession | undefined): SkoolPostSession {
  const now = new Date().toISOString();
  return {
    id: `skool-post-${Date.now()}`,
    onboardingSessionId: onboardingSession?.id,
    clientLabel:
      onboardingSession?.profile.businessName || onboardingSession?.profile.name || "No client linked",
    messages: [],
    post: {},
    complete: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionId, message } = body as {
    sessionId?: string;
    message?: string;
  };

  const userText = (message ?? "").trim();

  type Prep =
    | { kind: "error"; status: number; message: string }
    | {
        kind: "ok";
        session: SkoolPostSession;
        clientContext: ClientContext;
        clientId?: string;
        model?: string;
        isKickoff: boolean;
      };

  const prep = await mutateDb<Prep>((data) => {
    const model = data.settings.anthropicModel;
    let session: SkoolPostSession | undefined;
    if (sessionId) {
      session = data.skoolPostSessions.find((s) => s.id === sessionId);
      if (!session) return { kind: "error", status: 404, message: "Skool Posts session not found." };
    } else {
      const onboarding = pickDefaultOnboardingSession(data.onboardingSessions);
      session = newSession(onboarding);
      data.skoolPostSessions.push(session);
    }

    if (isRunning(session)) {
      return {
        kind: "error",
        status: 409,
        message: "Quill is still working on your last message — give it a moment before sending another.",
      };
    }

    const isKickoff = userText.length === 0 && session.messages.length === 0;
    if (!isKickoff) {
      session.messages.push({ role: "user", content: userText });
    }

    const now = new Date().toISOString();
    session.runStatus = "running";
    session.runningSince = now;
    session.runError = undefined;
    session.updatedAt = now;

    const onboarding = session.onboardingSessionId
      ? data.onboardingSessions.find((s) => s.id === session!.onboardingSessionId)
      : undefined;
    const clientContext: ClientContext = {
      profile: onboarding?.profile,
      voice: onboarding?.voice,
      ica: onboarding?.ica,
      contentGuide: onboarding?.contentGuide,
    };

    return {
      kind: "ok",
      session: structuredClone(session),
      clientContext,
      clientId: onboarding?.clientId,
      model,
      isKickoff,
    };
  });

  if (prep.kind === "error") {
    return NextResponse.json({ error: prep.message }, { status: prep.status });
  }

  const { session, clientContext, clientId, model, isKickoff } = prep;
  const prompt = isKickoff ? KICKOFF_MESSAGE : userText;

  startTurn<SkoolPostSession>({
    select: (data) => data.skoolPostSessions,
    sessionId: session.id,
    run: async (s) => {
      const turn = await sendTurn({
        prompt,
        systemPrompt: buildQuillSystemPrompt(clientContext),
        resumeSessionId: s.claudeSessionId,
        model,
      });
      let latestSessionId = turn.sessionId;
      let replyText = turn.result;

      // Quill doesn't draft the post in the same turn it gathers the brief --
      // Echo reviews Quill's draft for voice fit, then Quill presents Echo's
      // version. Each is a separate resumed CLI call.
      if (replyText.includes(DRAFT_REQUESTED_SENTINEL)) {
        const draftTurn = await sendTurn({
          prompt: "Draft the post now, following the brief above.",
          systemPrompt: buildQuillDraftSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = draftTurn.sessionId;

        const echoTurn = await sendTurn({
          prompt: "Review the draft above in apply mode. Output the final revised version.",
          systemPrompt: buildEchoSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = echoTurn.sessionId;

        const presentTurn = await sendTurn({
          prompt:
            "Present Echo's finished draft above to the client now, then ask if they want a revision, a different format, or if this post is done.",
          systemPrompt: buildQuillSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = presentTurn.sessionId;
        replyText = presentTurn.result;
      }

      s.claudeSessionId = latestSessionId;

      let structuredOutput: Record<string, unknown> | undefined;
      if (replyText.includes(POST_COMPLETE_SENTINEL)) {
        replyText = replyText.replace(POST_COMPLETE_SENTINEL, "").trimEnd();
        const extraction = await extractStructured({
          resumeSessionId: latestSessionId,
          schema: skoolPostSchema,
          model,
        });
        structuredOutput = extraction.structuredOutput;
      }

      if (replyText) {
        s.messages.push({ role: "assistant", content: replyText });
      }

      if (structuredOutput) {
        s.post = { ...s.post, ...structuredOutput };
        s.complete = true;
        await mutateDb((_data, db) => {
          logActivity(db, {
            agent: "Quill",
            clientId,
            task: `Skool post: ${s.post.mode || "untitled"}`,
            status: "done",
          });
        });
      }
    },
  });

  return NextResponse.json({ sessionId: session.id, session, status: "running" });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const db = await getDb();
  if (id) {
    const session = db.data.skoolPostSessions.find((s) => s.id === id);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ session: withResolvedRunState(session) });
  }
  return NextResponse.json({ sessions: db.data.skoolPostSessions.map(withResolvedRunState) });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const all = url.searchParams.get("all") === "true";

  if (all) {
    const deleted = await mutateDb((data) => {
      const before = data.skoolPostSessions.length;
      data.skoolPostSessions = data.skoolPostSessions.filter((s) => !s.complete);
      return before - data.skoolPostSessions.length;
    });
    return NextResponse.json({ ok: true, deleted });
  }

  if (!id) {
    return NextResponse.json({ error: "A session id is required." }, { status: 400 });
  }
  const found = await mutateDb((data) => {
    const index = data.skoolPostSessions.findIndex((s) => s.id === id);
    if (index === -1) return false;
    data.skoolPostSessions.splice(index, 1);
    return true;
  });
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
