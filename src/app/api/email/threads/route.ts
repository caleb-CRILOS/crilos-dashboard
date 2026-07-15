import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listUnreadThreads } from "@/lib/gmail";

// Lists unread threads straight from Gmail -- doesn't touch
// emailDraftSessions, those only get created once a thread is actually
// processed (summarized + drafted).
export async function GET(req: NextRequest) {
  const db = await getDb();
  try {
    const threads = await listUnreadThreads(db.data.settings, req.nextUrl.origin);
    const clientsByEmail = new Map(
      db.data.clients.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]),
    );
    const enriched = threads.map((t) => {
      const emailMatch = t.from.match(/<([^>]+)>/)?.[1]?.toLowerCase() ?? t.from.toLowerCase();
      const client = clientsByEmail.get(emailMatch);
      return { ...t, clientId: client?.id, clientLabel: client?.name };
    });
    return NextResponse.json({ threads: enriched });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach Gmail." },
      { status: 502 },
    );
  }
}
