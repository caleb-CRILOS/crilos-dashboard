import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parseSkoolCsv } from "@/lib/skool";
import { mergeClients } from "@/lib/merge";
import { withHealth } from "@/lib/health";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const text = await file.text();
  const parsedClients = parseSkoolCsv(text);

  if (parsedClients.length === 0) {
    return NextResponse.json(
      { error: "No rows parsed. Check the CSV has 'name' and/or 'email' columns." },
      { status: 400 },
    );
  }

  const db = await getDb();
  const merged = mergeClients(db.data.clients, parsedClients);
  db.data.clients = withHealth(merged, db.data.settings.healthThresholds);
  await db.write();

  return NextResponse.json({ ok: true, imported: parsedClients.length });
}
