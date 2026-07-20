import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// POST /api/system/shutdown
// Clears the Memberful session, then stops this local dev server so port 3000
// is freed for the next launch. A browser page can't kill the server process,
// but this route runs *inside* it, so process.exit(0) terminates the actual
// server. The client (QuitButton) swaps to a "stopped" screen optimistically,
// so the connection dying mid-response is never user-visible.
//
// Stays on the default Node runtime (needs `process` + fs via getDb) — do not
// switch this handler to the edge runtime.
export async function POST() {
  const db = await getDb();
  db.data.settings.memberAuth = null; // clear session — a true sign-out
  await db.write();
  // Give the 200 time to flush to the browser before the process exits.
  setTimeout(() => process.exit(0), 500);
  return NextResponse.json({ ok: true });
}
