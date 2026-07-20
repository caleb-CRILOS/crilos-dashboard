"use client";

import { useState } from "react";

// The "Sign out & quit" control. A browser page can't stop the local server,
// so this POSTs to /api/system/shutdown — a route that runs inside the dev
// server process and calls process.exit(0), freeing port 3000 for the next
// launch (which matters: the Memberful sign-in redirect is registered for
// :3000, so a drifted port breaks sign-in). We swap to the "stopped" screen
// optimistically: the server dies mid-response, so we must not wait on the
// fetch resolving.
export default function QuitButton() {
  const [stopped, setStopped] = useState(false);

  function quit() {
    if (
      !confirm(
        "Stop the dashboard? You'll need to relaunch it to use it again.",
      )
    ) {
      return;
    }
    setStopped(true);
    // Fire-and-forget: the connection is severed when the server exits.
    fetch("/api/system/shutdown", { method: "POST" }).catch(() => {});
  }

  if (stopped) {
    return (
      <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-ink p-6">
        <div className="sheet stack relative w-full max-w-md p-8 md:p-10">
          <span className="corner tl acid" aria-hidden="true" />
          <span className="corner tr" aria-hidden="true" />
          <span className="corner bl" aria-hidden="true" />
          <span className="corner br acid" aria-hidden="true" />

          <div className="label-mono text-[11px] text-signal-ink">
            § DASHBOARD STOPPED
          </div>
          <h1 className="bleed-type mt-3">CRILOS</h1>
          <p className="mt-4 text-sm leading-relaxed text-paper-dim">
            The local server has shut down and port 3000 is free. You can close
            this tab now.
          </p>
          <div className="callout mt-6 text-[13px] leading-relaxed text-paper">
            <span className="cross" aria-hidden="true">
              +
            </span>
            To use the dashboard again, relaunch it — double-click{" "}
            <code className="font-mono text-signal-ink">start.command</code>{" "}
            (macOS) or{" "}
            <code className="font-mono text-signal-ink">start.cmd</code>{" "}
            (Windows), or run{" "}
            <code className="font-mono text-signal-ink">npm run dev</code>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={quit}
      className="label-mono text-[10px] text-paper-faint transition-colors hover:text-paper"
    >
      Sign out &amp; quit
    </button>
  );
}
