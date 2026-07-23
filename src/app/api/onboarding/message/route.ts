import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ChatMessage, OnboardingSession, OnboardingStage } from "@/lib/types";
import {
  buildContentGuideSystemPrompt,
  buildIcaSystemPrompt,
  buildSetupSystemPrompt,
  STAGE_COMPLETE_SENTINEL,
} from "@/lib/onboarding/prompts";
import { contentGuideSchema, icaSchema, setupSchema } from "@/lib/onboarding/schemas";
import { extractStructured, sendTurn } from "@/lib/claude-cli";
import { generateDeliverable } from "@/lib/pdf/generate";

const KICKOFF_MESSAGE = "Begin the onboarding conversation now, following your instructions.";

// A redo of an already-completed stage. Sent explicitly rather than relying on
// the isKickoff check below -- that only fires on an empty history, and a redo
// deliberately keeps the previous transcript.
const REVISE_KICKOFF_MESSAGE =
  "The client is revisiting this stage to update what's on file. Greet them back and begin the review now, following your instructions.";

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
    contentGuideMessages: [],
    claudeSessionIds: {},
    profile: {},
    voice: {},
    ica: {},
    contentGuide: {},
    setupComplete: false,
    icaComplete: false,
    contentGuideComplete: false,
    deliverables: {},
    createdAt: now,
    updatedAt: now,
  };
}

function messagesFor(session: OnboardingSession, stage: OnboardingStage): ChatMessage[] {
  if (stage === "setup") return session.setupMessages;
  if (stage === "ica") return session.icaMessages;
  return session.contentGuideMessages;
}

function schemaFor(stage: OnboardingStage) {
  if (stage === "setup") return setupSchema;
  if (stage === "ica") return icaSchema;
  return contentGuideSchema;
}

// `revising` switches each stage into review mode: the same interview, but
// opened with the answers already on file and driven by "what's changed?".
function systemPromptFor(
  session: OnboardingSession,
  stage: OnboardingStage,
  revising: boolean,
): string {
  if (stage === "setup") {
    return buildSetupSystemPrompt(
      revising ? { profile: session.profile, voice: session.voice } : undefined,
    );
  }
  if (stage === "ica") {
    return buildIcaSystemPrompt(session.profile, revising ? session.ica : undefined);
  }
  return buildContentGuideSystemPrompt(
    session.profile,
    session.voice,
    session.ica,
    revising ? session.contentGuide : undefined,
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionId, stage, message, clientId, intent } = body as {
    sessionId?: string;
    stage: OnboardingStage;
    message?: string;
    clientId?: string;
    intent?: "revise";
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

  // Starting a redo: drop only the stage's CLI session id so the next turn
  // opens a fresh conversation against the revise prompt. The transcript stays
  // (the new exchange appends to it) and the stage stays marked complete --
  // an abandoned redo must not downgrade a stage whose data is still good.
  const startingRevision = intent === "revise";
  if (startingRevision) {
    session.claudeSessionIds[stage] = undefined;
    session.revisingStages = { ...session.revisingStages, [stage]: true };
  }
  // Stays true for every turn of the redo, not just the one that opened it --
  // each CLI call is handed a fresh system prompt, so dropping this on turn 2
  // would put Atlas back on the first-contact script mid-revision.
  const revising = !!session.revisingStages?.[stage];

  const isKickoff = userText.length === 0 && history.length === 0;
  const prompt = startingRevision
    ? REVISE_KICKOFF_MESSAGE
    : isKickoff
      ? KICKOFF_MESSAGE
      : userText;

  if (!isKickoff && !startingRevision) {
    history.push({ role: "user", content: userText });
  }

  let replyText: string;
  let structuredOutput: Record<string, unknown> | undefined;

  try {
    const turn = await sendTurn({
      prompt,
      systemPrompt: systemPromptFor(session, stage, revising),
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
    session.contentGuide = { ...session.contentGuide, ...input };
    session.contentGuideComplete = true;
  }

  // Stamp the finish so the UI can spot a later stage built on answers that a
  // redo has since changed, and close out any redo that was in flight.
  session.stageCompletedAt = {
    ...session.stageCompletedAt,
    [stage]: new Date().toISOString(),
  };
  if (session.revisingStages?.[stage]) {
    session.revisingStages = { ...session.revisingStages, [stage]: false };
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
