import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ClientAsset } from "@/lib/types";
import { saveAssetFile } from "@/lib/assets";

// v1 scope: plain-text/markdown only -- mirrors how the CRILOS CLI's
// client/assets/ were plain files Claude could read directly. Binary/PDF
// text extraction is out of scope here.
const ALLOWED_EXTENSIONS = [".txt", ".md"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const assets = db.data.clientAssets.filter((a) => a.clientId === id);
  return NextResponse.json({ assets });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const db = await getDb();
  if (!db.data.clients.some((c) => c.id === clientId)) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: "Only .txt and .md files are supported for now." },
      { status: 400 },
    );
  }

  const content = await file.text();
  const asset: ClientAsset = {
    id: `asset-${Date.now()}`,
    clientId,
    fileName: `${Date.now()}-${file.name}`,
    title: file.name,
    uploadedAt: new Date().toISOString(),
  };

  saveAssetFile(clientId, asset.fileName, content);
  db.data.clientAssets.push(asset);
  await db.write();

  return NextResponse.json({ asset });
}
