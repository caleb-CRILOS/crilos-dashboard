# CRILOS (local edition)

A small, local business dashboard for solo coaches/consultants: client
health tracking (green/yellow/red), revenue overview, and a Claude-powered
daily insights brief. Runs entirely on your own machine — no hosting, no
subscription, your data stays in a JSON file on disk.

Inspired by the kind of dashboard shown in "I Built an AI Operating System
for Coaches," rebuilt from scratch as something you actually own and can
edit. It's a starting point, not a clone — expect to extend it as your
needs get more specific.

## What it does

- **Overview** — active clients, MRR, at-risk count, a revenue trend chart.
- **Clients** — every client you've connected, sorted by health status, with a
  detail page showing their engagement history.
- **Insights** — click a button and Claude reads your current client/revenue
  data and gives you a short brief: summary, priorities, flags.
- **Settings** — where you plug in your own API keys and connect data
  sources. Nothing is hardcoded; the app starts completely empty, and it
  fills in as you onboard and connect real data.
- **Onboarding** — a guided chat that builds your business profile, voice
  profile, ideal-client-avatar, and content bible, generating a PDF at each
  stage.
- **Build tools** — a suite of Claude-powered work assets orchestrated by
  Atlas: Sage (research), Quill (messaging/copy), Hawk (sales outreach),
  Steward (document ops), each reviewed by Echo for voice/tone fit before
  it's presented. See the in-app Agent Directory on the Overview page for
  the full, current roster.

## Before you start: what's actually possible with each data source

**GoHighLevel** has a real API. You'll create a **Private Integration
Token** in your GHL sub-account (Settings → Private Integrations), which is
simpler than the full OAuth app flow and is the right fit for a personal
tool like this. This app pulls Contacts and Opportunities and turns them
into clients with revenue and status.

**Skool does not have a public API** (confirmed via Skool's own community
forum — no REST API, no official webhooks, no app marketplace, as of 2026).
So "connecting Skool" here means one of:

1. **Zapier** — Skool has native Zapier triggers (member joined, payment
   received). Point a Zap's webhook action at
   `POST http://localhost:3000/api/skool/webhook`.
2. **Stripe webhooks** — since Skool bills through Stripe, you can listen to
   Stripe events directly (subscription created/canceled) and forward the
   relevant ones to the same endpoint.
3. **CSV export** — Skool lets community owners export their member list.
   Upload that file on the Settings page for a point-in-time snapshot.

Any dashboard claiming a direct "Skool API" integration is, under the hood,
doing one of these three things — there's no other way in right now.

## Getting started

**Prerequisites**

- **Git** — to install, and to receive updates later with `git pull`.
- **Node.js 20 or 22 LTS**.
- **Claude Code CLI**, installed and logged in (`claude auth status`).
  Onboarding and every Build tool (Sage, Quill, Hawk, Steward, Echo) run
  through it, not the Anthropic API directly. The separate Anthropic API key
  in Settings is only for the Insights brief (see "Connect Claude" below).
- **An active membership** in the community that gave you this app — you sign
  in with it on first launch (see "Members-only sign-in" below).

**Install and run**

```bash
git clone https://github.com/caleb-CRILOS/crilos-dashboard.git
cd crilos-dashboard
npm install
npm run dev
```

> **Using Claude Code?** Skip the terminal — open Claude Code and paste:
> *"Clone https://github.com/caleb-CRILOS/crilos-dashboard.git, run npm
> install, then start the dev server and open http://localhost:3000."*
> Claude handles the whole install and launch, asking permission as it goes.
> (You already have Claude Code — it's a prerequisite above.) Afterward,
> start a **new Claude Code session** inside the `crilos-dashboard` folder
> — this lets it pick up the project's `/start-dashboard` command (Claude
> Code only detects new skill folders at session start).

Open http://localhost:3000. Run it on **port 3000** — the sign-in redirect is
registered for that port. On first launch you'll hit the sign-in gate; once
you sign in, the dashboard starts completely empty — no sample data — so what
you see is your own, from the moment you first run it.

**Quick launch (day-to-day)**

After that first install you don't need the terminal — just double-click:

- **macOS** — `start.command` (the first time, right-click → **Open** to clear
  Gatekeeper).
- **Windows** — `start.cmd`.

Installing also drops a **"CRILOS Start"** shortcut on your Desktop that does the
same thing — double-click it instead of hunting for the file in the repo folder.
(Set `CRILOS_NO_SHORTCUT=1` before `npm install` to skip it; run `npm run
shortcut` to re-create it, e.g. after moving the folder.)

Either one frees **port 3000**, installs anything missing, opens your browser to
http://localhost:3000, then **closes its own window** — the server keeps running
in the background. It always uses port 3000: if an old instance was left running
it stops that first, so you never end up on a stray `localhost:3001` (which would
break sign-in, since the Memberful redirect is registered for :3000).

**Stopping it:** click **Sign out & quit** in the sidebar. That shuts the local
server down cleanly — freeing port 3000 and signing you out — and shows a
"Dashboard stopped" screen you can close. Because the launcher window is gone,
this (or relaunching the start script) is how you stop it. Relaunch any time with
the start script above (or `npm run dev`).

If the dashboard doesn't come up, the background server logs to
`%TEMP%\crilos-dashboard-dev.log` on Windows or `$TMPDIR/crilos-dashboard-dev.log`
on macOS — check there for the error.

## Members-only sign-in (Memberful)

The dashboard is gated: when it opens it asks the user to sign in with
**Memberful** and only unlocks for someone holding an **active** membership.
Sign-in uses Memberful's PKCE OAuth, so there is **no secret** to protect and
**no member list** shipped in this repo — the person signs into your Memberful
and the app simply asks Memberful whether their membership is active.

One-time setup, for whoever distributes this app:

1. In Memberful, go **Settings → Custom Applications → Add a new Custom
   Application**.
2. Choose the **Single-page** application type and enable **"Include OAuth
   tokens with this application"**.
3. Set the **OAuth Redirect URL** to exactly
   `http://localhost:3000/api/auth/memberful/callback`.
4. Copy the generated **Client ID** and your Memberful **subdomain** (the
   `SITE` in `SITE.memberful.com`) into
   [`src/lib/auth/memberfulConfig.ts`](src/lib/auth/memberfulConfig.ts).
5. Restart `npm run dev` — the gate now shows a working "Sign in with
   Memberful" button.

Notes:

- The **Client ID and subdomain are public** — safe to commit. There is no
  client secret to leak.
- To use the app yourself, hold an active membership on your own Memberful (a
  complimentary membership works).
- This is **soft** authentication: the app ships with its source, so it deters
  non-members rather than being unbreakable access control. A lapsed member is
  re-gated the next time they sign in.
- If Memberful rejects the `http://localhost` redirect when you register it,
  try `http://127.0.0.1:3000/api/auth/memberful/callback` and match
  `REDIRECT_URI` in the config file.

## Updating

Updates ship as new commits on this repo. To update:

```bash
git pull
npm install   # in case dependencies changed
```

Then relaunch — double-click `start.cmd` (Windows) or `start.command` (macOS),
or run `npm run dev`. On Windows you can run `./update.ps1` to do the pull +
install; on macOS/Linux `./update.sh` — both just run those two commands.

Your personal data is safe across updates: everything you enter lives in
`data/` and (optionally) `.env.local`, both git-ignored, so `git pull` never
touches them. If an update ever changes the shape of the stored data, the app
writes a timestamped backup (`data/db.json.bak-<timestamp>`) before migrating,
so nothing is lost.

## Connecting your data sources

These are optional — connect whichever you use, from the in-app **Settings**
page.

### Connect GoHighLevel

1. In GHL, go to **Settings → Private Integrations** and create a new
   token with read access to Contacts and Opportunities.
2. Copy your **Location ID** (found in Settings → Business Info, or in the
   URL when viewing your sub-account).
3. In the dashboard, go to **Settings**, paste both values in, and save.
4. Go to **Clients** and click **Sync GoHighLevel**.

### Connect Skool

Pick whichever of these is easiest for you:

- **Zapier**: create a Zap with a Skool trigger (e.g. "New Member") and a
  "Webhooks by Zapier → POST" action pointed at
  `http://localhost:3000/api/skool/webhook`, with a JSON body like:
  ```json
  { "event": "member_joined", "email": "{{member_email}}", "name": "{{member_name}}" }
  ```
  Set a shared secret on the Settings page first, and add it as the header
  `x-webhook-secret` in the Zap.
- **CSV**: export your member list from Skool, then upload it on the
  Settings page. Expected columns: `name`, `email`, `last_active`, `joined`,
  `status` (extra columns are ignored, and column names are matched
  loosely).

Note: your dashboard needs to be reachable for a Zapier webhook to hit it.
While you're running this purely on `localhost` that only works for
testing with tools like `curl`; to actually receive live Zapier webhooks
you'll need to either deploy this app somewhere with a public URL, or run
a tunnel (e.g. `ngrok http 3000`) pointed at your local server.

### Connect Claude

1. Get an API key from the [Claude/Anthropic
   console](https://console.anthropic.com/).
2. Paste it into the **Claude / Anthropic** section on the Settings page.
3. The Insights brief button is temporarily disabled in the UI
   (`INSIGHTS_BRIEF_ENABLED` in
   [InsightsClient.tsx](src/app/insights/InsightsClient.tsx)) — flip it back
   on to generate a brief once your key is saved.

If the default model ID in `src/lib/anthropic.ts` stops working (Anthropic
periodically retires older model versions), check
https://docs.claude.com/en/docs/about-claude/models for the current list
and either update the code or set a model override on the Settings page.

## How data is stored

Everything lives in `data/db.json`, a plain JSON file created the first
time you run the app. It's git-ignored by default since it'll contain real
client PII once you connect live data — don't commit it if you push this
project to a repo. There's no database server to install or manage.

This is a good fit for one person, running one instance, on one machine.
It is **not** built for multiple people editing concurrently — if you
outgrow that, look at swapping `src/lib/db.ts` for a real database
(Postgres via Prisma, SQLite via a properly-installed native driver, etc.)
and reuse the same route/page structure.

## Adjusting client health rules

Go to **Settings → Health thresholds**. Green = active within N days;
yellow = active within a wider window; red = past that window, or a
past-due payment, or a paused/churned status (payment/status issues always
override the activity-based calculation — see `src/lib/health.ts`).

## Project structure

```
src/
  lib/
    types.ts       Core data model (Client, EngagementEvent, Settings, ...)
    db.ts           Local JSON file storage
    ghl.ts          GoHighLevel API client + client mapping
    skool.ts        Skool webhook + CSV parsing
    merge.ts        Dedupes/merges clients across data sources by email
    health.ts        Green/yellow/red health engine
    anthropic.ts     Claude insights generation
  app/
    page.tsx                    Overview
    clients/page.tsx            Client list
    clients/[id]/page.tsx       Client detail
    insights/page.tsx           Claude insights panel
    settings/page.tsx           API keys, thresholds, CSV upload
    api/ghl/sync/route.ts       Triggers a GHL pull
    api/skool/webhook/route.ts  Receives Zapier/Stripe events
    api/skool/import/route.ts   Parses an uploaded CSV
    api/insights/route.ts       Calls Claude and stores the result
    api/settings/route.ts       Reads/writes settings
```

## Extending it

Natural next steps, roughly in order of how the original video's demo
built up its own platform:

- A "working agents" section — small scripts/prompts that draft content,
  summarize a client's recent activity, or flag a specific risk, wired up
  the same way `src/lib/anthropic.ts` calls Claude.
- Scheduled syncing (a cron job or scheduled task that hits
  `/api/ghl/sync` periodically instead of requiring a manual click).
- A real database if you outgrow the JSON file, or if you want multiple
  people to use it.

## Tech stack

Next.js (App Router) + TypeScript + Tailwind CSS, a local JSON file for
storage (via `lowdb`), `recharts` for the revenue chart, and the
`@anthropic-ai/sdk` for Claude insights.
