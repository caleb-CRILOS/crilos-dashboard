import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ChatMessage, OnboardingSession, OnboardingStage } from "@/lib/types";
import {
  buildContentBibleSystemPrompt,
  buildIcaSystemPrompt,
  buildSetupSystemPrompt,
  STAGE_COMPLETE_SENTINEL,
} from "@/lib/onboarding/prompts";
import { contentBibleSchema, icaSchema, setupSchema } from "@/lib/onboarding/schemas";
import { extractStructured, sendTurn } from "@/lib/claude-cli";
import { generateDeliverable } from "@/lib/pdf/generate";

const KICKOFF_MESSAGE = "Begin the onboarding conversation now, following your instructions.";

const VOICE_FIELD_NAMES = new Set([
  "toneDescriptors",
  "energyLevel",
  "formality",
  "humor",
  "wordsUsed",
  "wordsAvoided",
  "jargon",
  "sentenceLength",
  "paragraphLength",
  "contractions",
  "formattingQuirks",
  "claimsOk",
  "claimsGuarded",
  "samples",
]);

function newSession(clientId: string | undefined): OnboardingSession {
  const now = new Date().toISOString();
  return {
    id: `onboarding-${Date.now()}`,
    clientId,
    stage: "setup",
    setupMessages: [],
    icaMessages: [],
    contentBibleMessages: [],
    claudeSessionIds: {},
    profile: {},
    voice: {},
    ica: {},
    contentBible: {},
    setupComplete: false,
    icaComplete: false,
    contentBibleComplete: false,
    deliverables: {},
    createdAt: now,
    updatedAt: now,
  };
}

function messagesFor(session: OnboardingSession, stage: OnboardingStage): ChatMessage[] {
  if (stage === "setup") return session.setupMessages;
  if (stage === "ica") return session.icaMessages;
  return session.contentBibleMessages;
}

function schemaFor(stage: OnboardingStage) {
  if (stage === "setup") return setupSchema;
  if (stage === "ica") return icaSchema;
  return contentBibleSchema;
}

function systemPromptFor(session: OnboardingSession, stage: OnboardingStage): string {
  if (stage === "setup") return buildSetupSystemPrompt();
  if (stage === "ica") return buildIcaSystemPrompt(session.profile);
  return buildContentBibleSystemPrompt(session.profile, session.voice, session.ica);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionId, stage, message, clientId } = body as {
    sessionId?: string;
    stage: OnboardingStage;
    message?: string;
    clientId?: string;
  };

  const db = await getDb();
  const { anthropicModel } = db.data.settings;

  let session: OnboardingSession | undefined;
  if (sessionId) {
    session = db.data.onboardingSessions.find((s) => s.id === sessionId);
    if (!session) {
      return NextResponse.json({ error: "Onboarding session not found." }, { status: 404 });
    }
  } else {
    session = newSession(clientId);
    db.data.onboardingSessions.push(session);
  }

  session.stage = stage;
  const history = messagesFor(session, stage);
  const userText = (message ?? "").trim();
  const isKickoff = userText.length === 0 && history.length === 0;
  const prompt = isKickoff ? KICKOFF_MESSAGE : userText;

  if (!isKickoff) {
    history.push({ role: "user", content: userText });
  }

  let replyText: string;
  let structuredOutput: Record<string, unknown> | undefined;

  try {
    const turn = await sendTurn({
      prompt,
      systemPrompt: systemPromptFor(session, stage),
      resumeSessionId: session.claudeSessionIds[stage],
      model: anthropicModel,
    });
    session.claudeSessionIds[stage] = turn.sessionId;
    replyText = turn.result;

    if (replyText.includes(STAGE_COMPLETE_SENTINEL)) {
      replyText = replyText.replace(STAGE_COMPLETE_SENTINEL, "").trimEnd();
      const extraction = await extractStructured({
        resumeSessionId: turn.sessionId,
        schema: schemaFor(stage),
        model: anthropicModel,
      });
      structuredOutput = extraction.structuredOutput;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach Claude Code." },
      { status: 502 },
    );
  }

  if (replyText) {
    history.push({ role: "assistant", content: replyText });
  }

  let deliverableError: string | undefined;
  if (structuredOutput) {
    applyStageResult(session, stage, structuredOutput);
    try {
      session.deliverables[stage] = await generateDeliverable(session, stage);
    } catch (err) {
      // The conversation itself succeeded -- don't fail the whole request
      // over a PDF render issue, just surface it alongside the reply.
      deliverableError = err instanceof Error ? err.message : "Failed to generate deliverable PDF.";
    }
  }

  session.updatedAt = new Date().toISOString();
  await db.write();

  return NextResponse.json({
    sessionId: session.id,
    session,
    reply: replyText,
    deliverableError,
  });
}

function applyStageResult(
  session: OnboardingSession,
  stage: OnboardingStage,
  input: Record<string, unknown>,
) {
  if (stage === "setup") {
    const profileUpdate: Record<string, unknown> = {};
    const voiceUpdate: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (VOICE_FIELD_NAMES.has(key)) voiceUpdate[key] = value;
      else profileUpdate[key] = value;
    }
    session.profile = { ...session.profile, ...profileUpdate };
    session.voice = { ...session.voice, ...voiceUpdate };
    session.setupComplete = true;
  } else if (stage === "ica") {
    session.ica = { ...session.ica, ...input };
    session.icaComplete = true;
  } else {
    session.contentBible = { ...session.contentBible, ...input };
    session.contentBibleComplete = true;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const db = await getDb();
  if (id) {
    const session = db.data.onboardingSessions.find((s) => s.id === id);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ session });
  }
  return NextResponse.json({ sessions: db.data.onboardingSessions });
}
