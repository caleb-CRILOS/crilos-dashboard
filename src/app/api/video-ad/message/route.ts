import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mutateDb } from "@/lib/dbWrite";
import { isRunning, startTurn, withResolvedRunState } from "@/lib/agentJobs";
import { VideoAdSession, OnboardingSession } from "@/lib/types";
import {
  buildEchoSystemPrompt,
  buildQuillHookSystemPrompt,
  buildQuillSystemPrompt,
  buildVideoAdSystemPrompt,
  DRAFT_REQUESTED_SENTINEL,
  HOOK_REQUESTED_SENTINEL,
  SCRIPT_COMPLETE_SENTINEL,
} from "@/lib/videoAd/prompts";
import { videoAdScriptSchema } from "@/lib/videoAd/schemas";
import { extractStructured, sendTurn } from "@/lib/claude-cli";
import { deleteDeliverableFile, generateVideoAdDeliverable } from "@/lib/pdf/generate";
import { pickDefaultOnboardingSession } from "@/lib/agentContext";

const KICKOFF_MESSAGE = "Begin the conversation now, following your instructions.";

type ClientContext = Parameters<typeof buildVideoAdSystemPrompt>[0];

function newSession(onboardingSession: OnboardingSession | undefined): VideoAdSession {
  const now = new Date().toISOString();
  return {
    id: `video-ad-${Date.now()}`,
    onboardingSessionId: onboardingSession?.id,
    clientLabel:
      onboardingSession?.profile.businessName ||
      onboardingSession?.profile.name ||
      "No client linked",
    messages: [],
    script: {},
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
        session: VideoAdSession;
        clientContext: ClientContext;
        model?: string;
        isKickoff: boolean;
      };

  const prep = await mutateDb<Prep>((data) => {
    const model = data.settings.anthropicModel;
    let session: VideoAdSession | undefined;
    if (sessionId) {
      session = data.videoAdSessions.find((s) => s.id === sessionId);
      if (!session) return { kind: "error", status: 404, message: "Video ad session not found." };
    } else {
      const onboarding = pickDefaultOnboardingSession(data.onboardingSessions);
      session = newSession(onboarding);
      data.videoAdSessions.push(session);
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

    return { kind: "ok", session: structuredClone(session), clientContext, model, isKickoff };
  });

  if (prep.kind === "error") {
    return NextResponse.json({ error: prep.message }, { status: prep.status });
  }

  const { session, clientContext, model, isKickoff } = prep;
  const prompt = isKickoff ? KICKOFF_MESSAGE : userText;

  startTurn<VideoAdSession>({
    select: (data) => data.videoAdSessions,
    sessionId: session.id,
    run: async (s) => {
      const turn = await sendTurn({
        prompt,
        systemPrompt: buildVideoAdSystemPrompt(clientContext),
        resumeSessionId: s.claudeSessionId,
        model,
      });
      let latestSessionId = turn.sessionId;
      let replyText = turn.result;

      // Atlas doesn't write the hook-candidate menu itself -- Quill does, no
      // Echo pass (it's a disposable pick-one menu). Atlas relays it.
      if (replyText.includes(HOOK_REQUESTED_SENTINEL)) {
        const quillHookTurn = await sendTurn({
          prompt: "Write the hook candidates now.",
          systemPrompt: buildQuillHookSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = quillHookTurn.sessionId;

        const presentHookTurn = await sendTurn({
          prompt: "Greet the client and present Quill's hook candidates above now.",
          systemPrompt: buildVideoAdSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = presentHookTurn.sessionId;
        replyText = presentHookTurn.result;
      }

      // Atlas doesn't draft -- Quill drafts, Echo reviews Quill's draft for
      // voice fit and framework fidelity, then Atlas presents Echo's version.
      if (replyText.includes(DRAFT_REQUESTED_SENTINEL)) {
        const quillTurn = await sendTurn({
          prompt: "Draft the script now, following the brief above.",
          systemPrompt: buildQuillSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = quillTurn.sessionId;

        const echoTurn = await sendTurn({
          prompt: "Review the draft above in apply mode. Output the final revised version.",
          systemPrompt: buildEchoSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = echoTurn.sessionId;

        const presentTurn = await sendTurn({
          prompt:
            "Present Echo's finished script above to the client now, then ask if they want a variation or if this script is done.",
          systemPrompt: buildVideoAdSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = presentTurn.sessionId;
        replyText = presentTurn.result;
      }

      s.claudeSessionId = latestSessionId;

      let structuredOutput: Record<string, unknown> | undefined;
      if (replyText.includes(SCRIPT_COMPLETE_SENTINEL)) {
        replyText = replyText.replace(SCRIPT_COMPLETE_SENTINEL, "").trimEnd();
        const extraction = await extractStructured({
          resumeSessionId: latestSessionId,
          schema: videoAdScriptSchema,
          model,
        });
        structuredOutput = extraction.structuredOutput;
      }

      if (replyText) {
        s.messages.push({ role: "assistant", content: replyText });
      }

      if (structuredOutput) {
        s.script = { ...s.script, ...structuredOutput };
        s.complete = true;
        try {
          s.deliverable = await generateVideoAdDeliverable(s);
        } catch (err) {
          console.error("[video-ad] deliverable generation failed:", err);
        }
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
    const session = db.data.videoAdSessions.find((s) => s.id === id);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ session: withResolvedRunState(session) });
  }
  return NextResponse.json({ sessions: db.data.videoAdSessions.map(withResolvedRunState) });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "A session id is required." }, { status: 400 });
  }

  const removed = await mutateDb((data) => {
    const index = data.videoAdSessions.findIndex((s) => s.id === id);
    if (index === -1) return undefined;
    const [session] = data.videoAdSessions.splice(index, 1);
    return session;
  });
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (removed.deliverable?.fileName) {
    deleteDeliverableFile(removed.deliverable.fileName);
  }

  return NextResponse.json({ ok: true });
}
