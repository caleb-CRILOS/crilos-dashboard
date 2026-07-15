// Serialized, race-free persistence for the JSON-file db.
//
// getDb() deliberately re-reads db.json on every call (no in-memory
// singleton -- see the comment in src/lib/db.ts). That's fine for reads, but
// it means a naive read-modify-write clobbers concurrent writers: two
// overlapping requests each read the whole file, each mutate their own slice,
// and whoever calls db.write() last overwrites the other's changes to every
// OTHER slice. That race was rare while turns ran synchronously one-at-a-time
// behind a blocking UI; now that agent turns run detached in the background
// (src/lib/agentJobs.ts) and the user is encouraged to run several at once,
// two turns finishing near-simultaneously would silently drop one's session.
//
// mutateDb() closes that window: every write goes through a single
// process-wide promise chain (an async mutex), and crucially it re-reads the
// db FRESH inside the lock, so each mutation is applied on top of the latest
// on-disk state rather than a stale snapshot captured minutes earlier before
// a long CLI turn. Keep the mutator SHORT -- do the slow CLI work outside the
// lock, then call mutateDb only to persist the result, or you'll serialize
// every turn behind each other and lose the concurrency this is meant to
// protect.

import { getDb } from "./db";
import { DbSchema } from "./types";

type Db = Awaited<ReturnType<typeof getDb>>;

// The tail of the write chain. Each mutateDb call appends itself here so
// runs execute strictly one after another, never interleaved.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Run `fn` against a freshly-read db under a process-wide lock, then persist.
 * The db instance passed to `fn` reflects the latest state on disk (including
 * any writes that just committed), so mutating one session array can't revert
 * another. Returns whatever `fn` returns.
 */
export function mutateDb<T>(fn: (data: DbSchema, db: Db) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await getDb();
    const result = await fn(db.data, db);
    await db.write();
    return result;
  });
  // Keep the chain alive even if this run rejects, so one failed write doesn't
  // wedge every subsequent writer. Callers still see the rejection via `run`.
  queue = run.catch(() => undefined);
  return run;
}
