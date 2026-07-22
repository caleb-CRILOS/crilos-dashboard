import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { Settings } from "@/lib/types";

// Returns settings with secrets masked so the client-side settings page
// never has raw API keys sitting in the browser after the initial save.
function maskSecrets(settings: Settings) {
  const mask = (v?: string) => (v ? `${"•".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}` : "");
  return {
    ...settings,
    ghlPrivateToken: mask(settings.ghlPrivateToken),
    anthropicApiKey: mask(settings.anthropicApiKey),
    skoolWebhookSecret: mask(settings.skoolWebhookSecret),
    gmailClientSecret: mask(settings.gmailClientSecret),
    gmailRefreshToken: undefined, // never sent to the client at all, not even masked
    falApiKey: mask(settings.falApiKey),
    _hasGhlToken: Boolean(settings.ghlPrivateToken),
    _hasAnthropicKey: Boolean(settings.anthropicApiKey),
    _hasSkoolSecret: Boolean(settings.skoolWebhookSecret),
    _hasGmailClientSecret: Boolean(settings.gmailClientSecret),
    _gmailConnected: Boolean(settings.gmailRefreshToken),
    _hasFalApiKey: Boolean(settings.falApiKey),
  };
}

export async function GET() {
  const db = await getDb();
  return NextResponse.json({ settings: maskSecrets(db.data.settings) });
}

export async function POST(req: NextRequest) {
  const db = await getDb();
  const body = (await req.json()) as Partial<Settings>;

  db.data.settings = {
    ...db.data.settings,
    ...body,
    healthThresholds: {
      ...db.data.settings.healthThresholds,
      ...(body.healthThresholds ?? {}),
    },
  };
  await db.write();

  return NextResponse.json({ ok: true, settings: maskSecrets(db.data.settings) });
}
