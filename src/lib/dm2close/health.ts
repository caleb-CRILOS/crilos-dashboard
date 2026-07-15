// Lead Health for a DM 2 Close thread: how long it's been since the last
// message in the conversation (either the coach's update or Quill's
// reply -- the gap between them is seconds, negligible against the
// thresholds below), same green/yellow/red vocabulary as client health.
// Computed live rather than stored, since "hours since last message"
// keeps moving even when nothing new happens.

import { ChatMessage, DmSession, HealthStatus } from "../types";

export function computeLeadHealth(messages: ChatMessage[]): HealthStatus | undefined {
  const last = [...messages].reverse().find((m) => m.timestamp);
  if (!last?.timestamp) return undefined;

  const hoursSince = (Date.now() - new Date(last.timestamp).getTime()) / (1000 * 60 * 60);
  if (hoursSince < 36) return "green";
  if (hoursSince <= 60) return "yellow";
  return "red";
}

// Aggregate lead health across every DM 2 Close thread, same shape as
// healthCounts() in lib/health.ts. Sessions with no timestamped messages
// yet (computeLeadHealth returns undefined) don't count toward any bucket.
export function leadHealthCounts(sessions: DmSession[]) {
  return sessions.reduce(
    (acc, s) => {
      const h = computeLeadHealth(s.messages);
      if (h) acc[h] += 1;
      return acc;
    },
    { green: 0, yellow: 0, red: 0 } as Record<HealthStatus, number>,
  );
}
