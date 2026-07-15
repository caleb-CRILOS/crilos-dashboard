import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateBrandingStandard } from "@/lib/branding/generate";
import { deleteFile } from "@/lib/branding/storage";
import { BrandingStandard } from "@/lib/types";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

// Generation runs two CLI turns and can take a couple of minutes.
export const maxDuration = 360;

function deleteStandardFiles(standard: BrandingStandard) {
  deleteFile(standard.htmlFileName);
  deleteFile(standard.mdFileName);
  deleteFile(standard.sourceImageFileName);
  const { bodyFont, headingFont } = standard.tokens;
  for (const font of [bodyFont, headingFont]) {
    if (!font) continue;
    if (font.regularFileName) deleteFile(font.regularFileName);
    if (font.boldFileName) deleteFile(font.boldFileName);
  }
}

export async function GET() {
  const db = await getDb();
  return NextResponse.json({ standard: db.data.brandingStandard ?? null });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Upload a PNG, JPG, WEBP, or GIF image." },
      { status: 400 },
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 10 MB)." }, { status: 400 });
  }

  const db = await getDb();
  const { anthropicModel } = db.data.settings;
  const imageBuffer = Buffer.from(await file.arrayBuffer());

  let result;
  try {
    result = await generateBrandingStandard({
      imageBuffer,
      originalFileName: file.name,
      model: anthropicModel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate the branding standard.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Single active standard: write the new pointer first, then delete the
  // previous standard's files so a mid-way failure never leaves the db
  // pointing at files we already removed.
  const previous = db.data.brandingStandard;
  db.data.brandingStandard = result.standard;
  await db.write();
  if (previous) deleteStandardFiles(previous);

  return NextResponse.json({ standard: result.standard });
}

export async function DELETE() {
  const db = await getDb();
  const current = db.data.brandingStandard;
  db.data.brandingStandard = null;
  await db.write();
  if (current) deleteStandardFiles(current);
  return NextResponse.json({ ok: true });
}
