// Client health engine: turns raw activity/payment data into a
// green / yellow / red status, the same idea shown in the video.
//
// Rules (in priority order):
//   1. A failed/past-due payment always forces red.
//   2. Paused or churned clients are always red (nothing to track).
//   3. Otherwise, status is based on days since last activity, compared
//      against the configurable thresholds in Settings.

import { Client, HealthStatus, HealthThresholds } from "./types";

export function computeHealth(
  client: Client,
  thresholds: HealthThresholds,
): HealthStatus {
  if (client.paymentStatus === "past_due") return "red";
  if (client.status === "churned") return "red";
  if (client.status === "paused") return "red";

  if (!client.lastActivityAt) return "red";

  const daysSinceActivity =
    (Date.now() - new Date(client.lastActivityAt).getTime()) /
    (1000 * 60 * 60 * 24);

  if (daysSinceActivity <= thresholds.yellowDays) return "green";
  if (daysSinceActivity <= thresholds.redDays) return "yellow";
  return "red";
}

export function withHealth(
  clients: Client[],
  thresholds: HealthThresholds,
): Client[] {
  return clients.map((c) => ({ ...c, health: computeHealth(c, thresholds) }));
}

export function healthCounts(clients: Client[]) {
  return clients.reduce(
    (acc, c) => {
      const h = c.health ?? "red";
      acc[h] += 1;
      return acc;
    },
    { green: 0, yellow: 0, red: 0 } as Record<HealthStatus, number>,
  );
}
