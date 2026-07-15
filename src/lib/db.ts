// Local JSON-file database. No native compilation, no server process to
// run -- just a file on disk at data/db.json. Fine for single-user local
// use; not meant for concurrent multi-user access.
//
// Deliberately NOT cached as a module-level singleton: Next.js (especially
// under Turbopack in dev) can load route handlers and pages as separate
// module graphs, which means an in-memory "singleton" doesn't reliably
// stay in sync across them. The JSON file on disk is the actual source of
// truth, so every call re-reads it -- cheap enough for a local single-user
// dashboard, and it guarantees every request sees the latest data.

import { JSONFilePreset } from "lowdb/node";
import path from "path";
import fs from "fs";
import { DbSchema } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

// Bump this whenever a code update changes the SHAPE of stored data (renames
// a field, reshapes nested data, removes something) and add a matching entry
// to `migrations` below. Purely additive "new empty list/field" changes do
// NOT need a bump -- the idempotent back-fill in getDb() already covers them.
const CURRENT_SCHEMA_VERSION = 1;

type Migration = {
  version: number; // the schemaVersion this migration UPGRADES an older db TO
  migrate: (data: DbSchema) => void; // transform an existing db.data in place
};

// Ordered, run-once structural migrations for existing db.json files. Version
// 1 is the baseline (no migration needed). Example for a future change:
//   {
//     version: 2,
//     migrate: (d) => {
//       // e.g. rename a field on every client
//       for (const c of d.clients) { /* ... */ }
//     },
//   },
const migrations: Migration[] = [];

const defaultData: DbSchema = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  clients: [],
  events: [],
  revenueSnapshots: [],
  settings: {
    healthThresholds: { yellowDays: 7, redDays: 14 },
    theme: "kore",
    memberAuth: null,
  },
  insights: [],
  onboardingSessions: [],
  messagingSessions: [],
  videoAdSessions: [],
  dmSessions: [],
  dmConversionOutcomes: [],
  activityLog: [],
  sageSessions: [],
  hawkSessions: [],
  stewardSessions: [],
  skoolPostSessions: [],
  digitalProductSessions: [],
  clientAssets: [],
  emailDraftSessions: [],
  composeEmailSessions: [],
  brandingStandard: null,
  inboxSeenThreadIds: [],
};

export async function getDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = await JSONFilePreset<DbSchema>(DB_PATH, defaultData);
  // JSONFilePreset only writes defaultData to disk if the file didn't
  // exist yet; make sure that first-run write actually happens so the
  // file (and therefore sample data) is visible on disk immediately.
  if (!fs.existsSync(DB_PATH)) {
    await db.write();
  }
  // Run-once structural migrations for existing db.json files whose data
  // shape predates the current code. A fresh db.json already carries the
  // current schemaVersion (from defaultData), so nothing runs on first use.
  const fromVersion = db.data.schemaVersion ?? 0;
  const pending = migrations
    .filter((m) => m.version > fromVersion)
    .sort((a, b) => a.version - b.version);
  const needsPersist = pending.length > 0 || fromVersion !== CURRENT_SCHEMA_VERSION;
  if (pending.length > 0) {
    // Back up the pre-migration file first so a bad migration is recoverable.
    // Best-effort: a failed backup must not block the app from starting.
    try {
      fs.copyFileSync(DB_PATH, `${DB_PATH}.bak-${Date.now()}`);
    } catch {
      // ignore -- proceed without a backup rather than lock the user out
    }
    for (const m of pending) m.migrate(db.data);
  }
  db.data.schemaVersion = CURRENT_SCHEMA_VERSION;
  if (needsPersist) {
    // Persist the migrated data / version stamp. getDb() can be called
    // concurrently within a single request (the layout and the page both
    // call it), and lowdb's atomic write isn't concurrency-safe, so a racing
    // write can throw ENOENT on the temp-file rename. That's harmless -- the
    // other writer wins and the stamp lands -- so swallow it rather than
    // break the render. Once one write persists schemaVersion, later loads
    // see needsPersist === false and stop writing.
    try {
      await db.write();
    } catch {
      // concurrent-write race -- ignore
    }
  }
  // Back-fill fields added to DbSchema after a db.json already existed on
  // disk -- JSONFilePreset's default only applies on first-ever write.
  if (!db.data.onboardingSessions) {
    db.data.onboardingSessions = [];
  }
  for (const session of db.data.onboardingSessions) {
    if (!session.deliverables) session.deliverables = {};
  }
  if (!db.data.messagingSessions) {
    db.data.messagingSessions = [];
  }
  if (!db.data.videoAdSessions) {
    db.data.videoAdSessions = [];
  }
  if (!db.data.dmSessions) {
    db.data.dmSessions = [];
  }
  if (!db.data.dmConversionOutcomes) {
    db.data.dmConversionOutcomes = [];
  }
  if (!db.data.activityLog) {
    db.data.activityLog = [];
  }
  if (!db.data.sageSessions) {
    db.data.sageSessions = [];
  }
  if (!db.data.hawkSessions) {
    db.data.hawkSessions = [];
  }
  if (!db.data.stewardSessions) {
    db.data.stewardSessions = [];
  }
  if (!db.data.skoolPostSessions) {
    db.data.skoolPostSessions = [];
  }
  if (!db.data.digitalProductSessions) {
    db.data.digitalProductSessions = [];
  }
  if (!db.data.clientAssets) {
    db.data.clientAssets = [];
  }
  if (!db.data.emailDraftSessions) {
    db.data.emailDraftSessions = [];
  }
  if (!db.data.composeEmailSessions) {
    db.data.composeEmailSessions = [];
  }
  if (db.data.brandingStandard === undefined) {
    db.data.brandingStandard = null;
  }
  if (!db.data.inboxSeenThreadIds) {
    db.data.inboxSeenThreadIds = [];
  }
  if (db.data.settings.memberAuth === undefined) {
    db.data.settings.memberAuth = null;
  }
  return db;
}
