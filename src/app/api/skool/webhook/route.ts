import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { webhookToEvent, SkoolWebhookPayload } from "@/lib/skool";
import { withHealth } from "@/lib/health";

// Point a Zapier "Webhooks by Zapier" action (triggered by a Skool event)
// or a Stripe webhook (relayed through a tiny transform step) at:
//   POST http://localhost:3000/api/skool/webhook
//   Header: x-webhook-secret: <your skoolWebhookSecret from Settings>
//   Body: { "event": "payment", "email": "client@example.com", ... }
export async function POST(req: NextRequest) {
  const db = await getDb();
  const secret = db.data.settings.skoolWebhookSecret;

  if (secret) {
    const provided = req.headers.get("x-webhook-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }
  }

  let payload: SkoolWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.email || !payload.event) {
    return NextResponse.json(
      { error: "Payload must include at least 'email' and 'event'" },
      { status: 400 },
    );
  }

  let client = db.data.clients.find(
    (c) => c.email?.toLowerCase() === payload.email.toLowerCase(),
  );

  if (!client) {
    client = {
      id: `skool-${payload.email.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      name: payload.name || payload.email,
      email: payload.email,
      source: "skool",
      skoolUserId: payload.email,
      status: "active",
      joinedAt: new Date().toISOString(),
      paymentStatus: "unknown",
    };
    db.data.clients.push(client);
  }

  const event = webhookToEvent(payload, client.id);
  db.data.events.push(event);

  const now = event.occurredAt;
  client.lastActivityAt = client.lastActivityAt
    ? new Date(client.lastActivityAt) > new Date(now)
      ? client.lastActivityAt
      : now
    : now;

  if (payload.event === "payment") {
    client.lastPaymentAt = now;
    client.paymentStatus = "current";
  } else if (payload.event === "payment_failed") {
    client.paymentStatus = "past_due";
  }

  db.data.clients = withHealth(db.data.clients, db.data.settings.healthThresholds);
  await db.write();

  return NextResponse.json({ ok: true, clientId: client.id });
}
