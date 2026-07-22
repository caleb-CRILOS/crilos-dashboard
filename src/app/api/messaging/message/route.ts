import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mutateDb } from "@/lib/dbWrite";
import { isRunning, startTurn, withResolvedRunState } from "@/lib/agentJobs";
import { MessagingSession, OnboardingSession } from "@/lib/types";
import {
  buildEchoSystemPrompt,
  buildMessagingSystemPrompt,
  buildQuillIdeasSystemPrompt,
  buildQuillSystemPrompt,
  DRAFT_REQUESTED_SENTINEL,
  IDEAS_REQUESTED_SENTINEL,
  PIECE_COMPLETE_SENTINEL,
} from "@/lib/messaging/prompts";
import { messagingPieceSchema } from "@/lib/messaging/schemas";
import { extractStructured, sendTurn } from "@/lib/claude-cli";
import { deleteDeliverableFile, generateMessagingDeliverable } from "@/lib/pdf/generate";
import { deleteUpload } from "@/lib/messaging/slideUploads";
import { pickDefaultOnboardingSession } from "@/lib/agentContext";

const KICKOFF_MESSAGE = "Begin the conversation now, following your instructions.";

type ClientContext = Parameters<typeof buildMessagingSystemPrompt>[0];

function newSession(onboardingSession: OnboardingSession | undefined): MessagingSession {
  const now = new Date().toISOString();
  return {
    id: `messaging-${Date.now()}`,
    onboardingSessionId: onboardingSession?.id,
    clientLabel:
      onboardingSession?.profile.businessName ||
      onboardingSession?.profile.name ||
      "No client linked",
    messages: [],
    piece: {},
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

  // Resolve/create the session, guard against a double-submit, append the
  // user's message, and mark the turn running -- all in one serialized write.
  type Prep =
    | { kind: "error"; status: number; message: string }
    | {
        kind: "ok";
        session: MessagingSession;
        clientContext: ClientContext;
        model?: string;
        isKickoff: boolean;
      };

  const prep = await mutateDb<Prep>((data) => {
    const model = data.settings.anthropicModel;
    let session: MessagingSession | undefined;
    if (sessionId) {
      session = data.messagingSessions.find((s) => s.id === sessionId);
      if (!session) return { kind: "error", status: 404, message: "Messaging session not found." };
    } else {
      const onboarding = pickDefaultOnboardingSession(data.onboardingSessions);
      session = newSession(onboarding);
      data.messagingSessions.push(session);
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
      contentBible: onboarding?.contentBible,
    };

    return { kind: "ok", session: structuredClone(session), clientContext, model, isKickoff };
  });

  if (prep.kind === "error") {
    return NextResponse.json({ error: prep.message }, { status: prep.status });
  }

  const { session, clientContext, model, isKickoff } = prep;
  const prompt = isKickoff ? KICKOFF_MESSAGE : userText;

  startTurn<MessagingSession>({
    select: (data) => data.messagingSessions,
    sessionId: session.id,
    run: async (s) => {
      const turn = await sendTurn({
        prompt,
        systemPrompt: buildMessagingSystemPrompt(clientContext),
        resumeSessionId: s.claudeSessionId,
        model,
      });
      let latestSessionId = turn.sessionId;
      let replyText = turn.result;

      // Atlas doesn't write the content-idea menu itself -- Quill does, no
      // Echo pass (it's a disposable pick-one menu). Atlas then relays it.
      if (replyText.includes(IDEAS_REQUESTED_SENTINEL)) {
        const quillIdeasTurn = await sendTurn({
          prompt: "Write the content ideas now.",
          systemPrompt: buildQuillIdeasSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = quillIdeasTurn.sessionId;

        const presentIdeasTurn = await sendTurn({
          prompt: "Greet the client and present Quill's content ideas above now.",
          systemPrompt: buildMessagingSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = presentIdeasTurn.sessionId;
        replyText = presentIdeasTurn.result;
      }

      // Atlas doesn't draft -- Quill drafts, Echo reviews Quill's draft for
      // voice fit, then Atlas presents Echo's version. Each is a separate
      // resumed CLI call with its own --system-prompt.
      if (replyText.includes(DRAFT_REQUESTED_SENTINEL)) {
        const quillTurn = await sendTurn({
          prompt: "Draft the piece now, following the brief above.",
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
            "Present Echo's finished draft above to the client now, then ask if they want a variation or if this piece is done.",
          systemPrompt: buildMessagingSystemPrompt(clientContext),
          resumeSessionId: latestSessionId,
          model,
        });
        latestSessionId = presentTurn.sessionId;
        replyText = presentTurn.result;
      }

      s.claudeSessionId = latestSessionId;

      let structuredOutput: Record<string, unknown> | undefined;
      if (replyText.includes(PIECE_COMPLETE_SENTINEL)) {
        replyText = replyText.replace(PIECE_COMPLETE_SENTINEL, "").trimEnd();
        const extraction = await extractStructured({
          resumeSessionId: latestSessionId,
          schema: messagingPieceSchema,
          model,
        });
        structuredOutput = extraction.structuredOutput;
      }

      if (replyText) {
        s.messages.push({ role: "assistant", content: replyText });
      }

      if (structuredOutput) {
        s.piece = { ...s.piece, ...structuredOutput };
        s.complete = true;
        try {
          s.deliverable = await generateMessagingDeliverable(s);
        } catch (err) {
          console.error("[messaging] deliverable generation failed:", err);
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
    const session = db.data.messagingSessions.find((s) => s.id === id);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ session: withResolvedRunState(session) });
  }
  return NextResponse.json({ sessions: db.data.messagingSessions.map(withResolvedRunState) });
}

// A messaging session owns files in two places: the PDF and any rendered
// slide PNGs sit in data/deliverables/, while an uploaded slide background
// lives in data/messaging-uploads/. Only what slideFiles still lists gets
// cleaned up -- a re-render into fewer slides already orphans the extras.
function cleanupSessionFiles(s: MessagingSession) {
  if (s.deliverable?.fileName) deleteDeliverableFile(s.deliverable.fileName);
  for (const f of s.slideFiles ?? []) deleteDeliverableFile(f);
  if (s.slideImageFile) deleteUpload(s.slideImageFile);
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const all = url.searchParams.get("all") === "true";

  if (all) {
    // "all" clears finished pieces and leaves anything still in progress
    // alone, same semantics as Digital Product's delete-all. The array swap
    // goes through mutateDb so it can't clobber a concurrent turn; the disk
    // cleanup happens after, outside the lock.
    const toDelete = await mutateDb((data) => {
      const removed = data.messagingSessions.filter((s) => s.complete);
      data.messagingSessions = data.messagingSessions.filter((s) => !s.complete);
      return removed;
    });
    for (const s of toDelete) cleanupSessionFiles(s);
    return NextResponse.json({ ok: true, deleted: toDelete.length });
  }

  if (!id) {
    return NextResponse.json({ error: "A session id is required." }, { status: 400 });
  }
  const removed = await mutateDb((data) => {
    const index = data.messagingSessions.findIndex((s) => s.id === id);
    if (index === -1) return undefined;
    const [session] = data.messagingSessions.splice(index, 1);
    return session;
  });
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  cleanupSessionFiles(removed);
  return NextResponse.json({ ok: true });
}
