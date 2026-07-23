import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ComposeEmailSession } from "@/lib/types";
import {
  buildComposeAtlasSystemPrompt,
  buildComposeQuillSystemPrompt,
  EMAIL_DRAFT_REQUESTED_SENTINEL,
} from "@/lib/email/prompts";
import { buildStewardEchoSystemPrompt } from "@/lib/steward/prompts";
import { composeEmailSchema } from "@/lib/email/schemas";
import { extractStructured, sendTurn } from "@/lib/claude-cli";
import { pickDefaultOnboardingSession } from "@/lib/agentContext";

function newSession(): ComposeEmailSession {
  const now = new Date().toISOString();
  return {
    id: `compose-${Date.now()}`,
    messages: [],
    to: "",
    subject: "",
    bodyText: "",
    status: "drafting",
    createdAt: now,
    updatedAt: now,
  };
}

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionId, message } = body as { sessionId?: string; message?: string };

  const db = await getDb();
  const { anthropicModel } = db.data.settings;

  let session: ComposeEmailSession | undefined;
  if (sessionId) {
    session = db.data.composeEmailSessions.find((s) => s.id === sessionId);
    if (!session) {
      return NextResponse.json({ error: "Compose session not found." }, { status: 404 });
    }
  } else {
    session = newSession();
    db.data.composeEmailSessions.push(session);
  }

  const userText = (message ?? "").trim();
  if (!userText) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }
  session.messages.push({ role: "user", content: userText });

  // Single-user tool -- same "most complete/most recent onboarding
  // profile" heuristic as every other chat tool, so Quill still drafts in
  // a real voice instead of a blank one.
  const onboardingSession = pickDefaultOnboardingSession(db.data.onboardingSessions);
  const clientContext = {
    profile: onboardingSession?.profile,
    voice: onboardingSession?.voice,
    ica: onboardingSession?.ica,
    contentGuide: onboardingSession?.contentGuide,
  };

  const knownContacts = db.data.clients
    .filter((c) => c.email)
    .map((c) => ({ name: c.name, email: c.email! }));

  let replyText: string;

  try {
    const turn = await sendTurn({
      prompt: userText,
      systemPrompt: buildComposeAtlasSystemPrompt(clientContext, knownContacts),
      resumeSessionId: session.claudeSessionId,
      model: anthropicModel,
    });
    let latestSessionId = turn.sessionId;
    replyText = turn.result;

    if (replyText.includes(EMAIL_DRAFT_REQUESTED_SENTINEL)) {
      const quillTurn = await sendTurn({
        prompt: "Draft the email now, following the brief above.",
        systemPrompt: buildComposeQuillSystemPrompt(clientContext),
        resumeSessionId: latestSessionId,
        model: anthropicModel,
      });
      latestSessionId = quillTurn.sessionId;

      const echoTurn = await sendTurn({
        prompt: "Review the draft above in apply mode. Output the final revised version.",
        systemPrompt: buildStewardEchoSystemPrompt(clientContext),
        resumeSessionId: latestSessionId,
        model: anthropicModel,
      });
      latestSessionId = echoTurn.sessionId;

      const extraction = await extractStructured({
        resumeSessionId: latestSessionId,
        schema: composeEmailSchema,
        model: anthropicModel,
      });
      const extracted = extraction.structuredOutput as
        | { to?: string; subject?: string; bodyText?: string }
        | undefined;
      if (extracted?.to) session.to = extracted.to;
      if (extracted?.subject) session.subject = extracted.subject;
      if (extracted?.bodyText) session.bodyText = extracted.bodyText;
      if (session.to || session.subject || session.bodyText) session.status = "drafted";

      const client = session.to
        ? db.data.clients.find((c) => c.email?.toLowerCase() === session!.to.toLowerCase())
        : undefined;
      session.clientId = client?.id;
      session.clientLabel = client?.name;

      const presentTurn = await sendTurn({
        prompt: "Present Echo's finished draft above to the client now, then ask if they want any changes.",
        systemPrompt: buildComposeAtlasSystemPrompt(clientContext, knownContacts),
        resumeSessionId: latestSessionId,
        model: anthropicModel,
      });
      latestSessionId = presentTurn.sessionId;
      replyText = presentTurn.result;
    }

    session.claudeSessionId = latestSessionId;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach Claude Code." },
      { status: 502 },
    );
  }

  if (replyText) {
    session.messages.push({ role: "assistant", content: replyText });
  }

  session.updatedAt = new Date().toISOString();
  await db.write();

  return NextResponse.json({ sessionId: session.id, session, reply: replyText });
}
