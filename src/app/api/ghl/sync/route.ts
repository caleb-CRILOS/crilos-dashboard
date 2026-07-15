import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchGhlClients } from "@/lib/ghl";
import { mergeClients } from "@/lib/merge";
import { withHealth } from "@/lib/health";

export async function POST() {
  const db = await getDb();
  const { ghlPrivateToken, ghlLocationId, healthThresholds } = db.data.settings;

  if (!ghlPrivateToken || !ghlLocationId) {
    return NextResponse.json(
      {
        error:
          "Missing GHL credentials. Add ghlPrivateToken and ghlLocationId on the Settings page first.",
      },
      { status: 400 },
    );
  }

  try {
    const ghlClients = await fetchGhlClients({
      token: ghlPrivateToken,
      locationId: ghlLocationId,
    });

    const merged = mergeClients(db.data.clients, ghlClients);
    db.data.clients = withHealth(merged, healthThresholds);
    db.data.settings.lastGhlSyncAt = new Date().toISOString();
    await db.write();

    return NextResponse.json({
      ok: true,
      pulled: ghlClients.length,
      totalClients: db.data.clients.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error during GHL sync" },
      { status: 502 },
    );
  }
}
