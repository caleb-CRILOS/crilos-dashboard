// The dashboard's equivalent of the CRILOS CLI's reports/status-log.md --
// call this from a tool's API route after an agent action completes so a
// client's page can show "what's been done" without digging through raw
// session transcripts. Does not write the db itself -- caller still owns
// db.write() so this can be batched with the rest of a request's changes.

import { ActivityLogEntry, DbSchema } from "./types";

export function logActivity(
  db: { data: DbSchema },
  entry: Omit<ActivityLogEntry, "id" | "timestamp">,
): ActivityLogEntry {
  const logged: ActivityLogEntry = {
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  db.data.activityLog.push(logged);
  return logged;
}
