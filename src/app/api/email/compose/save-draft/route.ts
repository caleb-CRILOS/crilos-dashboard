import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createDraft } from "@/lib/gmail";
import { logActivity } from "@/lib/activityLog";

// The compose-flow counterpart to
// src/app/api/email/threads/[threadId]/create-draft/route.ts -- same
// "only ever creates a draft" guarantee (src/lib/gmail.ts has no send
// function), just for a brand-new email instead of a thread reply.
// Requires an explicit user action; nothing upstream calls this
// automatically.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { sessionId, to, subject, bodyText } = body as {
    sessionId?: string;
    to?: string;
    subject?: string;
    bodyText?: string;
  };

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const db = await getDb();
  const session = db.data.composeEmailSessions.find((s) => s.id === sessionId);
  if (!session) {
    return NextResponse.json({ error: "Compose session not found." }, { status: 404 });
  }

  const finalTo = (to ?? session.to).trim();
  const finalSubject = (subject ?? session.subject).trim();
  const finalBody = (bodyText ?? session.bodyText).trim();

  if (!finalTo) {
    return NextResponse.json({ error: "Add a recipient before saving." }, { status: 400 });
  }
  if (!finalBody) {
    return NextResponse.json({ error: "Draft text is empty." }, { status: 400 });
  }

  try {
    const gmailDraftId = await createDraft(db.data.settings, req.nextUrl.origin, {
      to: finalTo,
      subject: finalSubject,
      bodyText: finalBody,
    });

    session.to = finalTo;
    session.subject = finalSubject;
    session.bodyText = finalBody;
    session.status = "saved";
    session.gmailDraftId = gmailDraftId;
    session.updatedAt = new Date().toISOString();

    logActivity(db, {
      agent: "Quill",
      clientId: session.clientId,
      task: `Saved Gmail draft: ${finalSubject || "(no subject)"}`,
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
