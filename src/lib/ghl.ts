// GoHighLevel (HighLevel) API v2 client.
//
// Auth: uses a "Private Integration Token" (Settings > Private Integrations
// in your GHL sub-account), which is simpler than the full OAuth app flow
// and is the right choice for a personal, single-account local tool.
//
// NOTE: These endpoint shapes follow HighLevel's public API v2 docs
// (https://marketplace.gohighlevel.com/docs/). GHL does update fields from
// time to time -- if a sync fails, check the response body in the server
// console and cross-reference the current docs for that endpoint.

import { Client } from "./types";

const BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

interface GhlConfig {
  token: string;
  locationId: string;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Version: API_VERSION,
    Accept: "application/json",
  };
}

export interface GhlContact {
  id: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  dateAdded?: string;
  dateUpdated?: string;
  tags?: string[];
}

export interface GhlOpportunity {
  id: string;
  name?: string;
  contactId?: string;
  monetaryValue?: number;
  status?: string; // open | won | lost | abandoned
  pipelineStageId?: string;
  updatedAt?: string;
}

async function ghlFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GHL API request failed (${res.status} ${res.statusText}): ${body.slice(0, 500)}`,
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchContacts(config: GhlConfig): Promise<GhlContact[]> {
  const url = `${BASE_URL}/contacts/?locationId=${encodeURIComponent(config.locationId)}&limit=100`;
  const data = await ghlFetch<{ contacts: GhlContact[] }>(url, config.token);
  return data.contacts ?? [];
}

export async function fetchOpportunities(
  config: GhlConfig,
): Promise<GhlOpportunity[]> {
  const url = `${BASE_URL}/opportunities/search?location_id=${encodeURIComponent(config.locationId)}&limit=100`;
  const data = await ghlFetch<{ opportunities: GhlOpportunity[] }>(
    url,
    config.token,
  );
  return data.opportunities ?? [];
}

/**
 * Pulls contacts + opportunities from GHL and maps them into the
 * dashboard's Client shape. Opportunities are matched to contacts by
 * contactId so each client can carry revenue (monetaryValue) and payment
 * status derived from opportunity status.
 */
export async function fetchGhlClients(config: GhlConfig): Promise<Client[]> {
  const [contacts, opportunities] = await Promise.all([
    fetchContacts(config),
    fetchOpportunities(config),
  ]);

  const oppsByContact = new Map<string, GhlOpportunity[]>();
  for (const opp of opportunities) {
    if (!opp.contactId) continue;
    const list = oppsByContact.get(opp.contactId) ?? [];
    list.push(opp);
    oppsByContact.set(opp.contactId, list);
  }

  return contacts.map((contact) => {
    const opps = oppsByContact.get(contact.id) ?? [];
    const openOpp = opps.find((o) => o.status === "open") ?? opps[0];
    const totalValue = opps
      .filter((o) => o.status === "won")
      .reduce((sum, o) => sum + (o.monetaryValue ?? 0), 0);

    const name =
      contact.contactName ||
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      contact.email ||
      "Unnamed Contact";

    return {
      id: `ghl-${contact.id}`,
      name,
      email: contact.email,
      source: "ghl",
      ghlContactId: contact.id,
      ghlOpportunityId: openOpp?.id,
      status: openOpp?.status === "lost" ? "churned" : "active",
      joinedAt: contact.dateAdded ?? new Date().toISOString(),
      lastActivityAt: contact.dateUpdated ?? contact.dateAdded,
      mrr: totalValue || undefined,
      tags: contact.tags,
      paymentStatus: "unknown",
    } satisfies Client;
  });
}
