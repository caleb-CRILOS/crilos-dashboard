import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createDraftReply, getThread } from "@/lib/gmail";
import { logActivity } from "@/lib/activityLog";

// The only route in the app that actually writes to Gmail -- and even
// this only ever creates a draft (src/lib/gmail.ts has no send
// function). Requires an explicit user action; nothing upstream calls
// this automatically.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const body = await req.json().catch(() => ({}));
  const { draftText: overrideText } = body as { draftText?: string };

  const db = await getDb();
  const session = db.data.emailDraftSessions.find((s) => s.gmailThreadId === threadId);
  if (!session) {
    return NextResponse.json(
      { error: "This thread hasn't been summarized/drafted yet." },
      { status: 404 },
    );
  }

  const finalText = (overrideText ?? session.draftText).trim();
  if (!finalText) {
    return NextResponse.json({ error: "Draft text is empty." }, { status: 400 });
  }

  try {
    const thread = await getThread(db.data.settings, req.nextUrl.origin, threadId);
    const gmailDraftId = await createDraftReply(db.data.settings, req.nextUrl.origin, {
      threadId,
      to: thread.from,
      subject: thread.subject,
      bodyText: finalText,
      inReplyToMessageId: thread.lastMessageId,
    });

    session.draftText = finalText;
    session.status = "saved";
    session.gmailDraftId = gmailDraftId;
    session.updatedAt = new Date().toISOString();

    logActivity(db, {
      agent: "Steward",
      clientId: session.clientId,
      task: `Saved Gmail draft: ${session.subject}`,
      status: "done",
    });

    await db.write();
    return NextResponse.json({ session });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save the Gmail draft." },
      { status: 502 },
    );
  }
}
