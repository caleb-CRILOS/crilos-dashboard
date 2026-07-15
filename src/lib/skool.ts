// Skool has no public API (confirmed via Skool's own community forum as of
// 2026 -- no REST API, no official webhooks, no app marketplace). So
// "connecting Skool" to this dashboard means one of:
//
//   1. Zapier: Skool's native Zapier triggers (member joined, payment
//      received) -> a Zap that POSTs to /api/skool/webhook here.
//   2. Stripe webhooks: since Skool bills through Stripe, you can listen
//      to Stripe events directly and forward the relevant ones here.
//   3. Manual CSV export: Skool lets community owners export their member
//      list; upload that file on the Settings page for a point-in-time
//      snapshot of engagement/join dates.
//
// This file handles both the webhook payload shape and CSV parsing.

import Papa from "papaparse";
import { Client, EngagementEvent, EngagementType } from "./types";

export interface SkoolWebhookPayload {
  event: "member_joined" | "payment" | "payment_failed" | "post" | "comment";
  email: string;
  name?: string;
  occurredAt?: string;
  meta?: Record<string, unknown>;
}

const eventTypeMap: Record<SkoolWebhookPayload["event"], EngagementType> = {
  member_joined: "manual",
  payment: "payment",
  payment_failed: "payment_failed",
  post: "skool_post",
  comment: "skool_comment",
};

export function webhookToEvent(
  payload: SkoolWebhookPayload,
  clientId: string,
): EngagementEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    clientId,
    type: eventTypeMap[payload.event],
    occurredAt: payload.occurredAt ?? new Date().toISOString(),
    meta: payload.meta,
  };
}

export interface SkoolCsvRow {
  name: string;
  email: string;
  last_active?: string;
  joined?: string;
  status?: string;
}

/**
 * Parses a Skool member-export CSV. Expected columns (case-insensitive,
 * flexible on naming): name, email, last_active / last active, joined /
 * join date, status. Unknown columns are ignored.
 */
export function parseSkoolCsv(csvText: string): Client[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  return result.data
    .filter((row) => row.email || row.name)
    .map((row, i) => {
      const name = row.name || row.full_name || row.email || `Member ${i + 1}`;
      const lastActive = row.last_active || row.last_active_date;
      const joined = row.joined || row.join_date || row.date_joined;

      return {
        id: `skool-${(row.email || name).toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        name,
        email: row.email || undefined,
        source: "skool",
        skoolUserId: row.email,
        status: (row.status?.toLowerCase() as Client["status"]) || "active",
        joinedAt: joined ? new Date(joined).toISOString() : new Date().toISOString(),
        lastActivityAt: lastActive
          ? new Date(lastActive).toISOString()
          : undefined,
        paymentStatus: "unknown",
      } satisfies Client;
    });
}
