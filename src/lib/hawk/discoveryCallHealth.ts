// Lead health for a Discovery Call, parallel to src/lib/dm2close/health.ts
// but keyed off session.updatedAt rather than per-message timestamps --
// Discovery Call's ChatMessages never populate `timestamp` (only DM 2
// Close does), and updatedAt is already reliably bumped on every POST and
// the "mark call completed" PATCH (see src/app/api/discovery-call/message/
// route.ts). Same 36h/60h thresholds as computeLeadHealth for vocabulary
// consistency across the app.

import { HawkSession, HealthStatus } from "../types";

export function computeDiscoveryCallHealth(session: HawkSession): HealthStatus | undefined {
  if (session.stage === "Call Completed") return undefined;

  const hoursSince = (Date.now() - new Date(session.updatedAt).getTime()) / (1000 * 60 * 60);
  if (hoursSince < 36) return "green";
  if (hoursSince <= 60) return "yellow";
  return "red";
}
