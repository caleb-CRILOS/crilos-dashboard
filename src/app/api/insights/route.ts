import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateInsights } from "@/lib/anthropic";
import { withHealth } from "@/lib/health";

export async function POST() {
  const db = await getDb();
  const { anthropicApiKey, anthropicModel, healthThresholds } = db.data.settings;

  if (!anthropicApiKey) {
    return NextResponse.json(
      { error: "Add your Anthropic API key on the Settings page first." },
      { status: 400 },
    );
  }

  const clientsWithHealth = withHealth(db.data.clients, healthThresholds);

  try {
    const insight = await generateInsights(
      anthropicApiKey,
      anthropicModel,
      clientsWithHealth,
      db.data.revenueSnapshots,
    );
    db.data.insights.unshift(insight);
    db.data.insights = db.data.insights.slice(0, 20); // keep recent history only
    await db.write();
    return NextResponse.json({ ok: true, insight });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate insights" },
      { status: 502 },
    );
  }
}

export async function GET() {
  const db = await getDb();
  return NextResponse.json({ insights: db.data.insights });
}
