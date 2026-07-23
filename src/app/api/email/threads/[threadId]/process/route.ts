import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { EmailDraftSession } from "@/lib/types";
import { getThread } from "@/lib/gmail";
import { buildEmailDraftSystemPrompt, buildEmailSummarySystemPrompt } from "@/lib/email/prompts";
import { buildStewardEchoSystemPrompt } from "@/lib/steward/prompts";
import { sendTurn } from "@/lib/claude-cli";
import { pickOnboardingSessionForClient } from "@/lib/agentContext";
import { logActivity } from "@/lib/activityLog";

// One-shot pipeline for a single unread thread: summarize, draft a
// reply, voice-QA the draft. Not a chat -- each call redoes the full
// pipeline for this thread (re-summarize, re-draft), which is fine since
// there's no ongoing conversation state worth preserving between calls,
// unlike the chat-driven tools.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const db = await getDb();
  const { anthropicModel } = db.data.settings;

  let thread;
  try {
    thread = await getThread(db.data.settings, req.nextUrl.origin, threadId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach Gmail." },
      { status: 502 },
    );
  }

  const client = db.data.clients.find(
    (c) => c.email?.toLowerCase() === thread.fromEmail.toLowerCase(),
  );
  const onboardingSession = client
    ? pickOnboardingSessionForClient(db.data.onboardingSessions, client.id)
    : undefined;

  const clientContext = {
    profile: onboardingSession?.profile,
    voice: onboardingSession?.voice,
    ica: onboardingSession?.ica,
    contentGuide: onboardingSession?.contentGuide,
  };

  let summary: string;
  let draftText: string;

  try {
    const summaryTurn = await sendTurn({
      prompt: thread.bodyText,
      systemPrompt: buildEmailSummarySystemPrompt(),
      model: anthropicModel,
    });
    summary = summaryTurn.result;

    const draftTurn = await sendTurn({
      prompt: `Original email:\n\n${thread.bodyText}\n\nSummary:\n\n${summary}\n\nDraft the reply now.`,
      systemPrompt: buildEmailDraftSystemPrompt(clientContext),
      resumeSessionId: summaryTurn.sessionId,
      model: anthropicModel,
    });

    const echoTurn = await sendTurn({
      prompt: "Review the draft above in apply mode. Output the final revised version.",
      systemPrompt: buildStewardEchoSystemPrompt(clientContext),
      resumeSessionId: draftTurn.sessionId,
      model: anthropicModel,
    });
    draftText = echoTurn.result;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach Claude Code." },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();
  let session = db.data.emailDraftSessions.find((s) => s.gmailThreadId === threadId);
  if (session) {
    session.summary = summary;
    session.draftText = draftText;
    session.status = "drafted";
    session.updatedAt = now;
  } else {
    session = {
      id: `email-${Date.now()}`,
      gmailThreadId: threadId,
      clientId: client?.id,
      clientLabel: client?.name ?? "No client match",
      fromAddress: thread.fromEmail,
      subject: thread.subject,
      summary,
      draftText,
      status: "drafted",
      createdAt: now,
      updatedAt: now,
    } satisfies EmailDraftSession;
    db.data.emailDraftSessions.push(session);
  }

  logActivity(db, {
    agent: "Steward",
    clientId: client?.id,
    task: `Email draft: ${thread.subject}`,
    status: "done",
  });

  await db.write();
  return NextResponse.json({ session, lastMessageId: thread.lastMessageId, fromHeader: thread.from });
}
