#!/usr/bin/env bash
# Double-click to launch the CRILOS Dashboard (macOS). Always runs on port 3000
# so the Memberful sign-in redirect (registered for :3000) keeps working.
#
# After launch this window closes and the server keeps running in the
# background. Stop it with "Sign out & quit" in the dashboard, or by relaunching
# this script.
#
# First run: right-click -> Open once to get past Gatekeeper. Closing the window
# uses AppleScript, so macOS may ask once to allow Terminal to control Terminal.
set -euo pipefail

# Double-clicking starts in the home folder — move to this script's folder.
cd "$(dirname "$0")"

# Free port 3000 so a leftover dashboard instance can't push this one onto 3001
# (which would break sign-in). Kills whatever is listening on 3000.
lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true

# Install dependencies on first run (visible so you can watch progress).
[ -d node_modules ] || npm install

# Remember this window's terminal so we can close exactly it at the end.
MY_TTY="$(tty)"

# Start the dev server detached so it survives this window closing. nohup +
# disown keep it alive; output goes to a temp log for troubleshooting.
nohup npm run dev > "${TMPDIR:-/tmp}/crilos-dashboard-dev.log" 2>&1 &
disown

# Open the browser a few seconds after the server starts listening (detached so
# it still fires after this window closes).
nohup bash -c 'sleep 3; open http://localhost:3000' >/dev/null 2>&1 &
disown

# Close this Terminal window (match by tty so only this one closes).
osascript <<OSA >/dev/null 2>&1 || true
tell application "Terminal"
  repeat with w in windows
    repeat with t in tabs of w
      if tty of t is "$MY_TTY" then close w saving no
    end repeat
  end repeat
end tell
OSA
