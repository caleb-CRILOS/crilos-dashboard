import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = await getDb();
  const { settings } = db.data;
  return NextResponse.json({
    enabled: Boolean(settings.gmailRefreshToken),
    lastCheckedAt: settings.inboxLastCheckedAt ?? null,
    hasUnseenMail: Boolean(settings.inboxHasUnseenMail),
  });
}

// Called when the user navigates to /inbox (see Sidebar.tsx) -- clears the
// "new mail" flag driving the nav link's attention color.
export async function POST() {
  const db = await getDb();
  db.data.settings.inboxHasUnseenMail = false;
  await db.write();
  return NextResponse.json({ ok: true });
}
