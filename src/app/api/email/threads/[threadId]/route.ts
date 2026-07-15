import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { markThreadRead, trashThread } from "@/lib/gmail";

// Moves the thread to Gmail's Trash. Reversible in Gmail for 30 days --
// this is not a permanent delete, same as the trash icon in Gmail's own UI.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const db = await getDb();
  try {
    await trashThread(db.data.settings, req.nextUrl.origin, threadId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete this email." },
      { status: 502 },
    );
  }
}

// Removes the UNREAD label so the thread drops out of the unread list.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const db = await getDb();
  try {
    await markThreadRead(db.data.settings, req.nextUrl.origin, threadId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to mark this email read." },
      { status: 502 },
    );
  }
}
