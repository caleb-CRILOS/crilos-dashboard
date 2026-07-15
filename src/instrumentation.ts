// Next.js instrumentation hook -- register() runs once when the server
// process starts (dev or prod). Used here to start the background inbox
// watcher (src/lib/inbox/watcher.ts), so it checks Gmail automatically
// for as long as the dev server is running, with no separate process or
// external cron needed.

const CHECK_INTERVAL_MS = 90 * 60 * 1000; // 90 minutes

declare global {
  // eslint-disable-next-line no-var
  var __crilosInboxWatcherStarted: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalThis.__crilosInboxWatcherStarted) return; // guard against double-start on hot reload
  globalThis.__crilosInboxWatcherStarted = true;

  const { checkForNewMail } = await import("@/lib/inbox/watcher");

  checkForNewMail().catch((err) => console.error("[inbox-watcher] startup check failed:", err));
  setInterval(() => {
    checkForNewMail().catch((err) => console.error("[inbox-watcher] scheduled check failed:", err));
  }, CHECK_INTERVAL_MS);
}
