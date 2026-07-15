import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deleteDeliverableFile } from "@/lib/pdf/generate";
import { generateSageBrandedDoc } from "@/lib/sage/brandedDoc";

// Branded-doc generation runs an Atlas CLI turn and can take a minute-plus.
export const maxDuration = 360;

export async function POST(req: Request) {
  const body = await req.json();
  const { id } = body as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "A session id is required." }, { status: 400 });
  }

  const db = await getDb();
  const session = db.data.sageSessions.find((s) => s.id === id);
  if (!session) {
    return NextResponse.json({ error: "Research thread not found." }, { status: 404 });
  }

  try {
    const { anthropicModel } = db.data.settings;
    session.brandedDoc = await generateSageBrandedDoc(session, anthropicModel);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate the branded doc." },
      { status: 500 },
    );
  }

  await db.write();

  return NextResponse.json({ session });
}

// Unlike every other tool's DELETE handler, this does NOT remove the
// session -- a research thread is an ongoing notebook, not a one-shot
// draft, so "delete" here only clears the exported branded doc. The thread
// stays in Research Threads and can be re-exported anytime. (Full thread
// deletion lives on DELETE /api/sage/message instead.)
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "A session id is required." }, { status: 400 });
  }

  const db = await getDb();
  const session = db.data.sageSessions.find((s) => s.id === id);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (session.brandedDoc?.fileName) {
    deleteDeliverableFile(session.brandedDoc.fileName);
  }
  session.brandedDoc = undefined;

  await db.write();

  return NextResponse.json({ ok: true });
}
