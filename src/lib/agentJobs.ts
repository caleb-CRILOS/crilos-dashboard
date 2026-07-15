// Runs an agent turn detached from the HTTP request that started it.
//
// Every chat tool used to run its Claude CLI turn(s) inside the POST handler
// and only respond once finished, so navigating away orphaned the result and
// the page booted fresh on return (the work still persisted -- the loss was
// entirely in the UI). startTurn() flips that: the route persists the user's
// message + runStatus:"running" up front, hands the slow turn to startTurn
// WITHOUT awaiting it, and responds immediately. The turn keeps running in the
// background (this is a long-lived `next dev`/`next start` Node process --
// single-user local, no serverless freeze, consistent with lowdb) and writes
// its result to db.json when done. Any page can then reattach by polling the
// GET ?id= endpoint, which reads db.json -- so status survives navigation and
// full reloads without relying on shared process memory (which Turbopack does
// not keep in sync across route handlers -- see the note in src/lib/db.ts).

import { getDb } from "./db";
import { mutateDb } from "./dbWrite";
import { AgentRunState, DbSchema } from "./types";

// The shape every chat session shares: an id, a timestamp, and the
// background-run fields. startTurn is generic over the concrete session type
// (DigitalProductSession, HawkSession, ...), constrained to this.
export interface ChatSession extends AgentRunState {
  id: string;
  updatedAt: string;
}

// A "running" session whose turn started longer ago than this is treated as
// interrupted rather than in-flight -- covers the dev server being restarted
// mid-turn (which kills the in-memory promise but leaves runStatus:"running"
// on disk). Generous enough for the longest real turn: the digital-product
// draft chain is up to 4 sequential CLI calls at ~120s each.
export const MAX_TURN_MS = 10 * 60_000;

function isStale(session: AgentRunState): boolean {
  if (!session.runningSince) return false;
  return Date.now() - new Date(session.runningSince).getTime() > MAX_TURN_MS;
}

// True only while a turn is genuinely in flight. A stale "running" session
// returns false so a new POST can recover it (start a fresh turn) instead of
// being 409'd forever. Routes use this for their double-submit guard.
export function isRunning(session: AgentRunState): boolean {
  return session.runStatus === "running" && !isStale(session);
}

// What the poll endpoint should report. Read-only: it never writes, so a GET
// during polling stays a pure read. A stale "running" session is surfaced as
// "error" so the client stops spinning and shows a recoverable banner; the
// stored state is left as-is (isRunning already treats it as recoverable, and
// the next successful turn overwrites it).
export function withResolvedRunState<S extends AgentRunState>(session: S): S {
  if (session.runStatus === "running" && isStale(session)) {
    return {
      ...session,
      runStatus: "error",
      runError:
        session.runError ||
        "This turn was interrupted (the dev server may have restarted). Start a new message to continue.",
    };
  }
  return session;
}

export interface StartTurnOptions<S extends ChatSession> {
  // Locates this session's array within the db, e.g. (data) =>
  // data.digitalProductSessions. Used to read a fresh snapshot before the turn
  // and to write the result back afterwards, so nothing else in db.json is
  // clobbered by a concurrent turn.
  select: (data: DbSchema) => S[];
  sessionId: string;
  // The tool-specific turn body (the old POST try-block). Mutates the passed
  // session in place -- append the assistant reply, set asset/deliverable/
  // complete, update claudeSessionId, etc. May throw; a throw is surfaced to
  // the user as runStatus:"error" + runError.
  run: (session: S) => Promise<void>;
  // Runs after the turn regardless of outcome -- e.g. deleting the scratch
  // copy an image/PDF turn needed. This used to live in the route's `finally`,
  // but the route now returns before the turn runs, so it moves here.
  cleanup?: () => void;
}

// Fire-and-forget. The caller (a POST handler) must NOT await this -- that's
// the whole point. It returns void immediately; the turn runs on its own.
export function startTurn<S extends ChatSession>(opts: StartTurnOptions<S>): void {
  void runDetached(opts);
}

async function runDetached<S extends ChatSession>({
  select,
  sessionId,
  run,
  cleanup,
}: StartTurnOptions<S>): Promise<void> {
  try {
    const db = await getDb();
    const found = select(db.data).find((s) => s.id === sessionId);
    if (!found) return; // deleted between the route persisting and us starting
    // Clone so the turn mutates a self-contained object, not the throwaway db
    // instance we just read; we persist this object back under the lock below.
    const session = structuredClone(found);

    await run(session);

    session.runStatus = undefined;
    session.runError = undefined;
    session.runningSince = undefined;
    session.updatedAt = new Date().toISOString();

    // Swap just this one element into a freshly-read db under the write lock,
    // leaving every other session (and every concurrent turn's write) intact.
    // Safe because a session that's "running" is 409-guarded against a second
    // turn, so nothing else mutates it in the meantime.
    await mutateDb((data) => {
      const arr = select(data);
      const i = arr.findIndex((s) => s.id === sessionId);
      if (i !== -1) arr[i] = session;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The agent turn failed.";
    console.error(`[agent-jobs] turn failed for session ${sessionId}:`, err);
    await mutateDb((data) => {
      const s = select(data).find((x) => x.id === sessionId);
      if (s) {
        s.runStatus = "error";
        s.runError = message;
        s.runningSince = undefined;
        s.updatedAt = new Date().toISOString();
      }
    }).catch((e) => console.error("[agent-jobs] failed to persist error state:", e));
  } finally {
    try {
      cleanup?.();
    } catch (e) {
      console.error("[agent-jobs] cleanup failed:", e);
    }
  }
}
