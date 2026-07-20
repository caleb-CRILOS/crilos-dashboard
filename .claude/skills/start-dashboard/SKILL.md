---
name: start-dashboard
description: Start the CRILOS Dashboard (Next.js/Turbopack) dev server and verify it's up. Use when asked to run, start, launch, or preview the CRILOS Dashboard app.
---

Fast path — skip exploration, go straight to these steps:

1. **Free port 3000 first.** The launch is pinned to 3000 (autoPort off), so a
   stale instance — or another chat's dev server — holding the port makes
   `preview_start` fail. Clear it before launching (PowerShell):
   `Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }; exit 0`
   (macOS/Linux: `lsof -ti tcp:3000 | xargs kill -9`).
2. Call `preview_start` with `name: "dev"`. `.claude/launch.json` defines it:
   `npm run dev`, port 3000, **autoPort off** — the app must stay on 3000
   because the Memberful sign-in redirect is registered for that port, so
   drifting to 3001 breaks sign-in. Next.js/Turbopack typically reports
   "Ready" in well under a second.
3. Verify with `preview_snapshot` (not `preview_screenshot` — the
   screenshot tool has been flaky/timing out on this project even when
   the server is healthy; the snapshot or `preview_logs` reliably confirm
   the page rendered).
4. If `preview_logs` shows `GET / 200`, the server is genuinely up even
   if screenshot hangs — don't retry screenshot more than once.

No need to re-check `package.json` scripts or re-read `launch.json` each
time; this config is stable. Only fall back to manual inspection if
`preview_start` errors (e.g. launch.json missing/changed).
