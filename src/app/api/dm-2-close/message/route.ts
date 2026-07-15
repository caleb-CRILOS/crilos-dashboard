import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mutateDb } from "@/lib/dbWrite";
import { isRunning, startTurn, withResolvedRunState } from "@/lib/agentJobs";
import { DmConversionOutcome, DmSession, DmStage } from "@/lib/types";
import {
  buildEchoSystemPrompt,
  buildQuillDraftSystemPrompt,
  buildQuillSystemPrompt,
  DRAFT_REQUESTED_SENTINEL,
} from "@/lib/dm2close/prompts";
import { dmStageSchema } from "@/lib/dm2close/schemas";
import { extractStructured, sendTurn } from "@/lib/claude-cli";
import { pickDefaultOnboardingSession } from "@/lib/agentContext";

const KICKOFF_MESSAGE = "Begin the conversation now, following your instructions.";

type ClientContext = Parameters<typeof buildQuillSystemPrompt>[0];

function newSession(
  onboardingSessionId: string | undefined,
  clientLabel: string,
  leadLabel: string,
): DmSession {
  const now = new Date().toISOString();
  return {
    id: `dm-2-close-${Date.now()}`,
    onboardingSessionId,
    clientLabel,
    leadLabel,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionId, message, leadLabel } = body as {
    sessionId?: string;
    message?: string;
    leadLabel?: string;
  };

  const userText = (message ?? "").trim();

  type Prep =
    | { kind: "error"; status: number; message: string }
    | {
        kind: "ok";
        session: DmSession;
        clientContext: ClientContext;
        model?: string;
        isKickoff: boolean;
      };

  const prep = await mutateDb<Prep>((data) => {
    const model = data.settings.anthropicModel;
    let session: DmSession | undefined;
    if (sessionId) {
      session = data.dmSessions.find((s) => s.id === sessionId);
      if (!session) return { kind: "error", status: 404, message: "DM 2 Close session not found." };
    } else {
      const label = (leadLabel ?? "").trim();
      if (!label) {
        return {
          kind: "error",
          status: 400,
          message: "A lead label is required to start a new DM 2 Close thread.",
        };
      }
      const onboarding = pickDefaultOnboardingSession(data.onboardingSessions);
      session = newSession(
        onboarding?.id,
        onboarding?.profile.businessName || onboarding?.profile.name || "No client linked",
        label,
      );
      data.dmSessions.push(session);
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
      session.messages.push({ role: "user", content: userText, timestamp: new Date().toISOString() });
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
      contentBible: onboarding?.contentBible,
    };

    return { kind: "ok", session: structuredClone(session), clientContext, model, isKickoff };
  });

  if (prep.kind === "error") {
    return NextResponse.json({ error: prep.message }, { status: prep.status });
  }

  const { session, clientContext, model, isKickoff } = prep;
  const prompt = isKickoff ? KICKOFF_MESSAGE : userText;

  startTurn<DmSession>({
    select: (data) => data.dmSessions,
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

      // Quill doesn't draft the reply in the same turn it confirms the stage
      // -- Echo reviews Quill's draft for voice fit and stage fidelity, then
      // Quill presents Echo's version. Each is a separate resumed CLI call.
      if (replyText.includes(DRAFT_REQUESTED_SENTINEL)) {
        const draftTurn = await sendTurn({
          prompt: "Draft the reply now, for the stage just confirmed above.",
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
          prompt: "Present Echo's finished reply above to the coach now, then ask what the lead said back.",
          systemPrompt: buildQuillSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = presentTurn.sessionId;
        replyText = presentTurn.result;

        try {
          const stageExtraction = await extractStructured({
            resumeSessionId: latestSessionId,
            schema: dmStageSchema,
            model,
          });
          const stage = stageExtraction.structuredOutput?.stage as DmStage | undefined;
          if (stage) s.currentStage = stage;
        } catch {
          // Bookkeeping only -- a failed stage extraction shouldn't block the
          // reply the coach is actually waiting on.
        }
      }

      s.claudeSessionId = latestSessionId;

      if (replyText) {
        s.messages.push({
          role: "assistant",
          content: replyText,
          timestamp: new Date().toISOString(),
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
    const session = db.data.dmSessions.find((s) => s.id === id);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ session: withResolvedRunState(session) });
  }
  return NextResponse.json({ sessions: db.data.dmSessions.map(withResolvedRunState) });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "A session id is required." }, { status: 400 });
  }
  // "true" / "false" -- did this lead convert (sale, new client, other
  // offer conversion)? Omitted entirely skips recording a KPI entry.
  const convertedParam = url.searchParams.get("converted");

  const removed = await mutateDb((data) => {
    const index = data.dmSessions.findIndex((s) => s.id === id);
    if (index === -1) return undefined;
    const [session] = data.dmSessions.splice(index, 1);

    if (convertedParam === "true" || convertedParam === "false") {
      const outcome: DmConversionOutcome = {
        id: `dm-outcome-${Date.now()}`,
        sessionId: session.id,
        onboardingSessionId: session.onboardingSessionId,
        clientLabel: session.clientLabel,
        leadLabel: session.leadLabel,
        converted: convertedParam === "true",
        stageAtDeletion: session.currentStage,
        recordedAt: new Date().toISOString(),
      };
      data.dmConversionOutcomes.push(outcome);
    }
    return session;
  });
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
