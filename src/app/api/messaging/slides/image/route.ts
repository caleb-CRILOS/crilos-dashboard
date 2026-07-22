import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import sharp from "sharp";
import { getDb } from "@/lib/db";
import { saveUpload, deleteUpload, uploadPath } from "@/lib/messaging/slideUploads";

// Manage the optional background photo used when rendering a session's slides.
//
// POST (multipart { sessionId, file }): accept an image, normalize it to PNG
// (strips odd metadata and avoids satori webp/format edge cases), store it
// under data/messaging-uploads/, and record its name on the session. The
// user still has to click Generate/Regenerate to actually re-render.
//
// DELETE (?sessionId=...): remove the stored photo and clear the record.

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

// GET (?sessionId=...): stream the stored background photo for a thumbnail.
// The bytes live under data/messaging-uploads/, not data/deliverables/, so
// they aren't reachable through the deliverables file route.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const db = await getDb();
  const session = db.data.messagingSessions.find((s) => s.id === sessionId);
  if (!session?.slideImageFile) {
    return NextResponse.json({ error: "No image for this session." }, { status: 404 });
  }

  const p = uploadPath(session.slideImageFile);
  if (!fs.existsSync(p)) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const buffer = fs.readFileSync(p);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${session.slideImageFile}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const sessionId = form.get("sessionId");
  const file = form.get("file");

  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, or WebP images are supported." },
      { status: 400 },
    );
  }

  const db = await getDb();
  const session = db.data.messagingSessions.find((s) => s.id === sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let png: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    png = await sharp(input).png().toBuffer();
  } catch {
    return NextResponse.json({ error: "Could not read that image." }, { status: 400 });
  }

  const safeId = session.id.replace(/[^a-zA-Z0-9_-]/g, "");
  const fileName = `${safeId}-bg.png`;
  saveUpload(fileName, png);

  session.slideImageFile = fileName;
  session.updatedAt = new Date().toISOString();
  await db.write();

  return NextResponse.json({ ok: true, slideImageFile: fileName });
}

export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const db = await getDb();
  const session = db.data.messagingSessions.find((s) => s.id === sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.slideImageFile) {
    deleteUpload(session.slideImageFile);
    session.slideImageFile = undefined;
    session.updatedAt = new Date().toISOString();
    await db.write();
  }

  return NextResponse.json({ ok: true });
}
