// Upserts a batch of clients (from GHL, Skool CSV, or manual entry) into
// the local DB. Matches existing records by email when possible, so the
// same person showing up in both GHL and a Skool export doesn't create a
// duplicate row -- their data is merged instead.

import { Client } from "./types";

export function mergeClients(existing: Client[], incoming: Client[]): Client[] {
  const byEmail = new Map<string, Client>();
  const byId = new Map<string, Client>();

  for (const c of existing) {
    byId.set(c.id, c);
    if (c.email) byEmail.set(c.email.toLowerCase(), c);
  }

  for (const inc of incoming) {
    const matchByEmail = inc.email ? byEmail.get(inc.email.toLowerCase()) : undefined;
    const match = matchByEmail ?? byId.get(inc.id);

    if (match) {
      const merged: Client = {
        ...match,
        ...inc,
        // Prefer the most recent lastActivityAt between the two records.
        lastActivityAt: mostRecent(match.lastActivityAt, inc.lastActivityAt),
        lastPaymentAt: mostRecent(match.lastPaymentAt, inc.lastPaymentAt),
        tags: Array.from(new Set([...(match.tags ?? []), ...(inc.tags ?? [])])),
        notes: match.notes ?? inc.notes,
      };
      byId.set(match.id, merged);
      if (merged.email) byEmail.set(merged.email.toLowerCase(), merged);
    } else {
      byId.set(inc.id, inc);
      if (inc.email) byEmail.set(inc.email.toLowerCase(), inc);
    }
  }

  return Array.from(byId.values());
}

function mostRecent(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() > new Date(b).getTime() ? a : b;
}
