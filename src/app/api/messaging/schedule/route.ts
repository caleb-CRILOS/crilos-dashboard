import { NextRequest, NextResponse } from "next/server";
import { mutateDb } from "@/lib/dbWrite";

// The day a finished piece is planned to go out. Local only: the date lives on
// the messaging session in db.json and drives the Posting schedule panel, with
// no Google Calendar round-trip -- deliberately, so scheduling works whether or
// not Google is connected in Settings.
//
// POST { sessionId, scheduledFor }  -> set the date (YYYY-MM-DD)
// DELETE ?sessionId=...             -> clear it
//
// Both go through mutateDb so a schedule edit can't clobber a chat turn that
// finishes at the same moment (see src/lib/dbWrite.ts).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Result =
  | { kind: "error"; status: number; message: string }
  | { kind: "ok"; scheduledFor?: string };

export async function POST(req: NextRequest) {
  let body: { sessionId?: string; scheduledFor?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, scheduledFor } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (!scheduledFor || !DATE_RE.test(scheduledFor)) {
    return NextResponse.json({ error: "A date (YYYY-MM-DD) is required." }, { status: 400 });
  }
  // Catches a date-shaped string that isn't a real day. An isNaN check alone
  // wouldn't: JS silently rolls 2026-02-31 over to Mar 3 rather than failing,
  // which would store a day the user never picked. Round-tripping the parsed
  // date back to YYYY-MM-DD only matches when no rollover happened.
  const parsed = new Date(`${scheduledFor}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== scheduledFor) {
    return NextResponse.json({ error: "That isn't a real date." }, { status: 400 });
  }

  const result = await mutateDb<Result>((data) => {
    const session = data.messagingSessions.find((s) => s.id === sessionId);
    if (!session) return { kind: "error", status: 404, message: "Session not found" };
    if (!session.complete) {
      return {
        kind: "error",
        status: 400,
        message: "This piece isn't finished yet — wrap up the conversation first.",
      };
    }
    session.scheduledFor = scheduledFor;
    session.updatedAt = new Date().toISOString();
    return { kind: "ok", scheduledFor };
  });

  if (result.kind === "error") {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ ok: true, scheduledFor: result.scheduledFor });
}

export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const result = await mutateDb<Result>((data) => {
    const session = data.messagingSessions.find((s) => s.id === sessionId);
    if (!session) return { kind: "error", status: 404, message: "Session not found" };
    session.scheduledFor = undefined;
    session.updatedAt = new Date().toISOString();
    return { kind: "ok" };
  });

  if (result.kind === "error") {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
