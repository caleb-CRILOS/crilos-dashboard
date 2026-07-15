import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deleteAssetFile } from "@/lib/assets";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> },
) {
  const { id: clientId, assetId } = await params;
  const db = await getDb();
  const index = db.data.clientAssets.findIndex((a) => a.id === assetId && a.clientId === clientId);
  if (index === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [asset] = db.data.clientAssets.splice(index, 1);
  deleteAssetFile(clientId, asset.fileName);
  await db.write();
  return NextResponse.json({ ok: true });
}
