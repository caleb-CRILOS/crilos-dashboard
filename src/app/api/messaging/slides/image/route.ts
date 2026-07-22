import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import sharp from "sharp";
import { getDb } from "@/lib/db";
import { saveUpload, deleteUpload, uploadPath } from "@/lib/messaging/slideUploads";
import { buildBackgroundPrompt, generateCoverBackground } from "@/lib/covers/imageGen";

// Manage the optional background photo used when rendering a session's slides.
//
// POST (multipart { sessionId, mode, ... }): attach a background and record it
// on the session. Either way the bytes are normalized to PNG (strips odd
// metadata and avoids satori webp/format edge cases) and stored under
// data/messaging-uploads/. The user still has to click Generate/Regenerate to
// actually re-render. `mode` picks where the image comes from:
//   - "upload" (default): take the posted `file`
//   - "ai": generate one from the piece's imageConcept via fal.ai, same
//     provider seam the Digital Product cover uses (src/lib/covers/imageGen.ts)
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
  const mode = (form.get("mode") as string) || "upload";

  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const db = await getDb();
  const session = db.data.messagingSessions.find((s) => s.id === sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Raw image bytes, however they were sourced, before the PNG normalize.
  let input: Buffer;

  if (mode === "ai") {
    const apiKey = db.data.settings.falApiKey;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Add a fal.ai API key in Settings to use AI backgrounds." },
        { status: 400 },
      );
    }
    // The piece's own art direction is the default seed; a prompt typed into
    // the card overrides it. buildBackgroundPrompt appends the no-text guard
    // either way, since the on-image copy is rendered by satori, not the model.
    const prompt = buildBackgroundPrompt({
      title: session.piece?.topic,
      userPrompt: (form.get("prompt") as string)?.trim() || session.piece?.imageConcept,
    });
    try {
      input = await generateCoverBackground(apiKey, prompt);
    } catch (err) {
      console.error("[messaging] background generation failed:", err);
      const message = err instanceof Error ? err.message : "Could not generate a background.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } else {
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, or WebP images are supported." },
        { status: 400 },
      );
    }
    input = Buffer.from(await file.arrayBuffer());
  }

  let png: Buffer;
  try {
    png = await sharp(input).png().toBuffer();
  } catch {
    return NextResponse.json({ error: "Could not read that image." }, { status: 400 });
  }

  const safeId = session.id.replace(/[^a-zA-Z0-9_-]/g, "");
  const fileName = `${safeId}-bg.png`;
  saveUpload(fileName, png);

  session.slideImageFile = fileName;
  session.slideImageKind = mode === "ai" ? "ai" : "upload";
  session.updatedAt = new Date().toISOString();
  await db.write();

  return NextResponse.json({ ok: true, slideImageFile: fileName, slideImageKind: session.slideImageKind });
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
    session.slideImageKind = undefined;
    session.updatedAt = new Date().toISOString();
    await db.write();
  }

  return NextResponse.json({ ok: true });
}
