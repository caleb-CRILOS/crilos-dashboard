import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getDb } from "@/lib/db";
import { renderCoverPng } from "@/lib/covers/renderCover";
import { generateDigitalProductDeliverable } from "@/lib/digitalProduct/generate";
import { deleteDeliverableFile } from "@/lib/pdf/generate";
import {
  coverUploadPath,
  saveCoverUpload,
  deleteCoverUpload,
} from "@/lib/covers/coverUploads";
import { buildBackgroundPrompt, generateCoverBackground } from "@/lib/covers/imageGen";
import { DigitalProductSession } from "@/lib/types";

// Cover art for a finished digital product.
//
// POST (formData): render the on-brand cover PNG, record it on the asset, and
// re-run the deliverable so the PDF picks up the cover as page 1. The `mode`
// field controls the optional full-bleed background BEHIND the (satori-rendered)
// cover text:
//   - "render" (default): render with whatever background is currently attached
//   - "ai":     generate a background via fal.ai (needs Settings.falApiKey), attach, render
//   - "upload": accept a `file`, attach it, render
//   - "remove-bg": clear the background, render the plain template
//
// DELETE (?sessionId=): remove the cover entirely and rebuild the plain deliverable.

const ALLOWED_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp"];

// Render the cover from the session's current asset state (+ background) and
// regenerate the deliverable so the PDF cover page stays in sync.
async function renderAndRegenerate(
  db: Awaited<ReturnType<typeof getDb>>,
  session: DigitalProductSession,
) {
  const bgFile = session.asset.coverBackgroundFileName;
  const coverImageFileName = await renderCoverPng(session.id, session.asset, session.clientLabel, {
    backgroundImagePath: bgFile ? coverUploadPath(bgFile) : undefined,
  });
  session.asset.coverImageFileName = coverImageFileName;
  session.deliverable = await generateDigitalProductDeliverable(session);
  session.updatedAt = new Date().toISOString();
  await db.write();
  return coverImageFileName;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const sessionId = form.get("sessionId");
  const mode = (form.get("mode") as string) || "render";
  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const db = await getDb();
  const session = db.data.digitalProductSessions.find((s) => s.id === sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (!session.complete) {
    return NextResponse.json({ error: "This product isn't finished yet." }, { status: 400 });
  }

  const safeId = session.id.replace(/[^a-zA-Z0-9_-]/g, "");
  const bgFileName = `${safeId}-bg.png`;

  try {
    if (mode === "ai") {
      const apiKey = db.data.settings.falApiKey;
      if (!apiKey) {
        return NextResponse.json(
          { error: "Add a fal.ai API key in Settings to use AI backgrounds." },
          { status: 400 },
        );
      }
      const prompt = buildBackgroundPrompt({
        title: session.asset.title,
        productType: session.asset.productType,
        userPrompt: (form.get("prompt") as string) || undefined,
      });
      const raw = await generateCoverBackground(apiKey, prompt);
      const png = await sharp(raw).png().toBuffer();
      saveCoverUpload(bgFileName, png);
      session.asset.coverBackgroundFileName = bgFileName;
      session.asset.coverBackgroundKind = "ai";
    } else if (mode === "upload") {
      const file = form.get("file");
      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
      }
      if (file.type && !ALLOWED_UPLOAD_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "Only PNG, JPEG, or WebP images are supported." },
          { status: 400 },
        );
      }
      const png = await sharp(Buffer.from(await file.arrayBuffer())).png().toBuffer();
      saveCoverUpload(bgFileName, png);
      session.asset.coverBackgroundFileName = bgFileName;
      session.asset.coverBackgroundKind = "upload";
    } else if (mode === "remove-bg") {
      if (session.asset.coverBackgroundFileName) {
        deleteCoverUpload(session.asset.coverBackgroundFileName);
      }
      session.asset.coverBackgroundFileName = undefined;
      session.asset.coverBackgroundKind = undefined;
    }

    const coverImageFileName = await renderAndRegenerate(db, session);
    return NextResponse.json({
      ok: true,
      coverImageFileName,
      coverBackgroundFileName: session.asset.coverBackgroundFileName ?? null,
      deliverable: session.deliverable,
    });
  } catch (err) {
    console.error("Cover render failed:", err);
    const message = err instanceof Error ? err.message : "Cover render failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const db = await getDb();
  const session = db.data.digitalProductSessions.find((s) => s.id === sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.asset.coverImageFileName) {
    deleteDeliverableFile(session.asset.coverImageFileName);
    session.asset.coverImageFileName = undefined;
  }
  if (session.asset.coverBackgroundFileName) {
    deleteCoverUpload(session.asset.coverBackgroundFileName);
    session.asset.coverBackgroundFileName = undefined;
    session.asset.coverBackgroundKind = undefined;
  }
  if (session.complete) session.deliverable = await generateDigitalProductDeliverable(session);
  session.updatedAt = new Date().toISOString();
  await db.write();

  return NextResponse.json({ ok: true, deliverable: session.deliverable });
}
