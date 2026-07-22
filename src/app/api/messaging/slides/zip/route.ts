import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import JSZip from "jszip";
import { getDb } from "@/lib/db";
import { deliverablePath } from "@/lib/pdf/generate";

// GET /api/messaging/slides/zip?sessionId=...
// Bundles a session's rendered slide PNGs into a single .zip download.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const db = await getDb();
  const session = db.data.messagingSessions.find((s) => s.id === sessionId);
  if (!session?.slideFiles?.length) {
    return NextResponse.json({ error: "No slides for this session." }, { status: 404 });
  }

  const zip = new JSZip();
  session.slideFiles.forEach((f, i) => {
    const p = deliverablePath(f);
    if (fs.existsSync(p)) zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, fs.readFileSync(p));
  });

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const slug =
    (session.piece.topic || "carousel")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "carousel";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-slides.zip"`,
    },
  });
}
