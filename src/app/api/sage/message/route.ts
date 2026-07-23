import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mutateDb } from "@/lib/dbWrite";
import { isRunning, startTurn, withResolvedRunState } from "@/lib/agentJobs";
import { SageSession } from "@/lib/types";
import { buildSageSystemPrompt } from "@/lib/sage/prompts";
import { sendTurn } from "@/lib/claude-cli";
import { pickDefaultOnboardingSession } from "@/lib/agentContext";
import { logActivity } from "@/lib/activityLog";
import { deleteDeliverableFile } from "@/lib/pdf/generate";

const KICKOFF_MESSAGE = "Begin the conversation now, following your instructions.";

// Sage needs live web access (market/competitor intel) -- every other
// tool leaves claude-cli.ts's default (no tools) in place.
const SAGE_TOOLS = "WebSearch,WebFetch";

type ClientContext = Parameters<typeof buildSageSystemPrompt>[0];

function newSession(
  onboardingSessionId: string | undefined,
  clientLabel: string,
  topic: string,
): SageSession {
  const now = new Date().toISOString();
  return {
    id: `sage-${Date.now()}`,
    onboardingSessionId,
    clientLabel,
    topic,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionId, message, topic } = body as {
    sessionId?: string;
    message?: string;
    topic?: string;
  };

  const userText = (message ?? "").trim();

  type Prep =
    | { kind: "error"; status: number; message: string }
    | {
        kind: "ok";
        session: SageSession;
        clientContext: ClientContext;
        clientId?: string;
        model?: string;
        isKickoff: boolean;
        isNewSession: boolean;
      };

  const prep = await mutateDb<Prep>((data) => {
    const model = data.settings.anthropicModel;
    let session: SageSession | undefined;
    let isNewSession = false;
    if (sessionId) {
      session = data.sageSessions.find((s) => s.id === sessionId);
      if (!session) return { kind: "error", status: 404, message: "Research thread not found." };
    } else {
      const label = (topic ?? "").trim();
      if (!label) {
        return { kind: "error", status: 400, message: "A topic is required to start a new research thread." };
      }
      const onboarding = pickDefaultOnboardingSession(data.onboardingSessions);
      session = newSession(
        onboarding?.id,
        onboarding?.profile.businessName || onboarding?.profile.name || "No client linked",
        label,
      );
      data.sageSessions.push(session);
      isNewSession = true;
    }

    if (isRunning(session)) {
      return {
        kind: "error",
        status: 409,
        message: "Sage is still researching your last message — give it a moment before sending another.",
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
      isNewSession,
    };
  });

  if (prep.kind === "error") {
    return NextResponse.json({ error: prep.message }, { status: prep.status });
  }

  const { session, clientContext, clientId, model, isKickoff, isNewSession } = prep;
  const prompt = isKickoff ? `${KICKOFF_MESSAGE} Research topic: ${session.topic}` : userText;

  startTurn<SageSession>({
    select: (data) => data.sageSessions,
    sessionId: session.id,
    run: async (s) => {
      const turn = await sendTurn({
        prompt,
        systemPrompt: buildSageSystemPrompt(clientContext),
        resumeSessionId: s.claudeSessionId,
        model,
        tools: SAGE_TOOLS,
      });
      s.claudeSessionId = turn.sessionId;
      const replyText = turn.result;

      if (replyText) {
        s.messages.push({ role: "assistant", content: replyText });
      }

      if (isNewSession) {
        await mutateDb((_data, db) => {
          logActivity(db, {
            agent: "Sage",
            clientId,
            task: `Research: ${s.topic}`,
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
    const session = db.data.sageSessions.find((s) => s.id === id);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ session: withResolvedRunState(session) });
  }
  return NextResponse.json({ sessions: db.data.sageSessions.map(withResolvedRunState) });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "A session id is required." }, { status: 400 });
  }

  const removed = await mutateDb((data) => {
    const index = data.sageSessions.findIndex((s) => s.id === id);
    if (index === -1) return undefined;
    const [session] = data.sageSessions.splice(index, 1);
    return session;
  });
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (removed.brandedDoc?.fileName) {
    deleteDeliverableFile(removed.brandedDoc.fileName);
  }

  return NextResponse.json({ ok: true });
}
