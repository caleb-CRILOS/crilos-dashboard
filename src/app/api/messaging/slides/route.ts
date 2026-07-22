import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { renderSlidePngs } from "@/lib/slides/renderSlides";
import { uploadPath } from "@/lib/messaging/slideUploads";

// POST /api/messaging/slides  { sessionId }
// Renders the session's carousel piece into on-brand slide PNGs (under
// data/deliverables/), records their file names on the session, and returns
// them. Idempotent: re-running overwrites the same files.
export async function POST(req: NextRequest) {
  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const db = await getDb();
  const session = db.data.messagingSessions.find((s) => s.id === sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (!session.complete || !session.piece?.finalText) {
    return NextResponse.json({ error: "This piece isn't finished yet." }, { status: 400 });
  }

  try {
    const slideFiles = await renderSlidePngs(session.id, session.piece, {
      backgroundImagePath: session.slideImageFile ? uploadPath(session.slideImageFile) : undefined,
    });
    session.slideFiles = slideFiles;
    session.updatedAt = new Date().toISOString();
    await db.write();
    return NextResponse.json({ ok: true, slideFiles });
  } catch (err) {
    console.error("Slide render failed:", err);
    return NextResponse.json({ error: "Slide render failed." }, { status: 500 });
  }
}
