// Background inbox watcher -- polls Gmail on a timer (see
// src/instrumentation.ts) and logs new unread mail to the activity log.
// Deliberately does NOT summarize/draft anything itself; it only detects
// and records "new unread thread showed up," same as a human glancing at
// their inbox. Summarize & draft still only happen when someone clicks
// the button on /inbox.

import { getDb } from "@/lib/db";
import { listUnreadThreads } from "@/lib/gmail";
import { logActivity } from "@/lib/activityLog";

// Only used to construct the OAuth2Client -- irrelevant to a refresh-token
// call like this one (no redirect ever happens), so any consistent value
// works even if the dev server's actual port differs (autoPort in
// launch.json).
const WATCHER_ORIGIN = "http://localhost:3000";

export async function checkForNewMail(): Promise<void> {
  // Read settings for auth only. We deliberately do NOT hold this db
  // instance across the slow Gmail round-trip below: lowdb's db.write()
  // serializes the WHOLE in-memory db, so a snapshot taken before the
  // network call would clobber any settings changed during it (e.g. a
  // user picking a new theme). We re-read fresh right before writing.
  const authDb = await getDb();
  const { settings } = authDb.data;
  if (!settings.gmailRefreshToken) return; // not connected yet -- nothing to poll

  let threads;
  try {
    threads = await listUnreadThreads(settings, WATCHER_ORIGIN);
  } catch (err) {
    // Don't throw out of a background timer -- just skip this cycle and
    // let the next one retry. Errors are visible via server logs.
    console.error("[inbox-watcher] failed to check Gmail:", err);
    return;
  }

  // Re-read immediately before mutating so we merge into the latest
  // on-disk state, not the pre-network-call snapshot. This keeps the
  // read->write window to a synchronous block (no awaits between), so a
  // concurrent settings write is no longer clobbered.
  const db = await getDb();
  const seen = new Set(db.data.inboxSeenThreadIds);
  const clientsByEmail = new Map(
    db.data.clients.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]),
  );

  let newCount = 0;
  for (const t of threads) {
    if (seen.has(t.threadId)) continue;
    newCount++;
    seen.add(t.threadId);
    const emailMatch = t.from.match(/<([^>]+)>/)?.[1]?.toLowerCase() ?? t.from.toLowerCase();
    const client = clientsByEmail.get(emailMatch);
    logActivity(db, {
      agent: "Inbox",
      clientId: client?.id,
      task: `New unread mail: ${t.subject} (from ${t.from})`,
      status: "needs-review",
    });
  }

  db.data.inboxSeenThreadIds = Array.from(seen);
  db.data.settings.inboxLastCheckedAt = new Date().toISOString();
  if (newCount > 0) {
    db.data.settings.inboxHasUnseenMail = true;
  }
  await db.write();

  if (newCount > 0) {
    console.log(`[inbox-watcher] found ${newCount} new unread thread(s)`);
  }
}
