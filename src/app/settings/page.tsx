import { getDb } from "@/lib/db";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = await getDb();
  const s = db.data.settings;
  const mask = (v?: string) =>
    v ? `${"•".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}` : "";

  const masked = {
    ...s,
    ghlPrivateToken: mask(s.ghlPrivateToken),
    anthropicApiKey: mask(s.anthropicApiKey),
    skoolWebhookSecret: mask(s.skoolWebhookSecret),
    gmailClientSecret: mask(s.gmailClientSecret),
    gmailRefreshToken: undefined,
    _hasGhlToken: Boolean(s.ghlPrivateToken),
    _hasAnthropicKey: Boolean(s.anthropicApiKey),
    _hasSkoolSecret: Boolean(s.skoolWebhookSecret),
    _hasGmailClientSecret: Boolean(s.gmailClientSecret),
    _gmailConnected: Boolean(s.gmailRefreshToken),
  };

  return <SettingsClient initialSettings={masked} />;
}
