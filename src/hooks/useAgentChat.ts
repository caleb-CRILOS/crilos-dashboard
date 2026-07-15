"use client";

// Shared conversation lifecycle for every chat tool.
//
// Agent turns now run detached on the server (see src/lib/agentJobs.ts): a
// POST returns immediately with the session marked runStatus:"running", and
// the turn finishes in the background. This hook is the client half of that
// contract -- it polls the tool's GET ?id= endpoint until the turn settles,
// so a running turn keeps showing progress even after the user navigates to
// another tool and back, and on mount it reattaches to the most recent
// unfinished conversation instead of booting a blank "start" screen. That's
// what makes "start a turn, leave, come back and it's still there / finished"
// work uniformly across all the tools.
//
// Pages keep their own bespoke UI (deliverable lists, thread pickers, delete
// flows). This hook owns only the shared core: the active session, the list,
// send(), polling, and mount-resume.

import { useCallback, useEffect, useRef, useState } from "react";

// The minimal shape this hook reads off a session. Each tool's real session
// type is far richer (assets, deliverables, stages...); the generic T carries
// all of that through untouched.
export interface AgentSessionLike {
  id: string;
  messages: unknown[];
  complete?: boolean;
  runStatus?: "running" | "error";
  runError?: string;
  updatedAt: string;
}

export interface SendArgs {
  message?: string;
  file?: File | null;
  // Extra POST fields used only when starting a NEW session, e.g. { topic }
  // for Market Research or { leadLabel } for DM 2 Close / Discovery Call.
  // Tools that don't use them just ignore them.
  fields?: Record<string, string>;
}

export interface UseAgentChatOptions<T> {
  // Base message endpoint, e.g. "/api/digital-product/message". Used for POST
  // (send), GET (list) and GET ?id= (poll a single session).
  endpoint: string;
  // "form" for tools that accept file uploads (multipart/form-data), "json"
  // for the rest.
  transport?: "json" | "form";
  // On mount, reattach to the most recent unsettled conversation (running, or
  // in-progress with messages). Single-conversation tools set this true so a
  // chat survives navigating away; multi-thread tools (a picker of threads)
  // leave it false and open threads explicitly via openSession.
  autoResume?: boolean;
  // Narrows which sessions the list + autoResume consider. Discovery Call
  // shares Hawk's storage and only wants leadLabel'd sessions, for example.
  filter?: (s: T) => boolean;
}

const POLL_MS = 2500;

export function useAgentChat<T extends AgentSessionLike>({
  endpoint,
  transport = "json",
  autoResume = false,
  filter,
}: UseAgentChatOptions<T>) {
  const [allSessions, setAllSessions] = useState<T[]>([]);
  const [session, setSession] = useState<T | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Which session the poll loop should accept responses for -- guards against
  // a late poll landing after the user switched threads.
  const activeIdRef = useRef<string | null>(null);
  // Keep filter in a ref so the mount effect can stay keyed on `endpoint`
  // alone (filters are defined inline in pages and would otherwise churn it).
  // useRef(filter) seeds the correct value for the mount bootstrap; the effect
  // just keeps it fresh for later refreshLists calls.
  const filterRef = useRef(filter);
  useEffect(() => {
    filterRef.current = filter;
  });

  const running = session?.runStatus === "running";
  const loading = sending || running;

  const applyFilter = useCallback((list: T[]) => {
    const f = filterRef.current;
    return f ? list.filter(f) : list;
  }, []);

  const refreshLists = useCallback(async () => {
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (res.ok) setAllSessions(applyFilter((data.sessions ?? []) as T[]));
    } catch {
      // Lists just won't refresh this time -- not worth an error banner.
    }
  }, [endpoint, applyFilter]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollOnce = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (!res.ok) return;
        const fresh = data.session as T | undefined;
        if (!fresh || activeIdRef.current !== fresh.id) return;
        setSession(fresh);
        if (fresh.runStatus !== "running") {
          stopPolling();
          if (fresh.runStatus === "error" && fresh.runError) setError(fresh.runError);
          refreshLists();
        }
      } catch {
        // Transient -- try again on the next tick.
      }
    },
    [endpoint, refreshLists, stopPolling],
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollRef.current = setInterval(() => pollOnce(id), POLL_MS);
    },
    [pollOnce, stopPolling],
  );

  // Open a specific session (e.g. a thread from a picker). Reattaches to its
  // running turn if there is one.
  const openSession = useCallback(
    (s: T) => {
      setError(null);
      setSessionId(s.id);
      setSession(s);
      activeIdRef.current = s.id;
      if (s.runStatus === "running") startPolling(s.id);
      else stopPolling();
    },
    [startPolling, stopPolling],
  );

  // Clear the active conversation (the "New" / "Draft another" affordance).
  const startFresh = useCallback(() => {
    stopPolling();
    setSession(null);
    setSessionId(null);
    activeIdRef.current = null;
    setError(null);
    setInput("");
  }, [stopPolling]);

  const send = useCallback(
    async ({ message = "", file = null, fields }: SendArgs) => {
      setSending(true);
      setError(null);
      try {
        let res: Response;
        if (transport === "form") {
          const form = new FormData();
          if (sessionId) form.set("sessionId", sessionId);
          form.set("message", message);
          if (file) form.set("file", file);
          if (fields) for (const [k, v] of Object.entries(fields)) form.set(k, v);
          res = await fetch(endpoint, { method: "POST", body: form });
        } else {
          res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: sessionId ?? undefined, message, ...(fields ?? {}) }),
          });
        }
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Something went wrong.");
          return;
        }
        setSessionId(data.sessionId);
        setSession(data.session as T);
        activeIdRef.current = data.sessionId;
        refreshLists();
        if ((data.session as T | undefined)?.runStatus === "running") {
          startPolling(data.sessionId);
        }
      } catch {
        setError("Request failed — is the dev server running?");
      } finally {
        setSending(false);
      }
    },
    [endpoint, transport, sessionId, refreshLists, startPolling],
  );

  // Mount: load the list and, for single-conversation tools, reattach to the
  // most recent unsettled conversation so it isn't lost by navigating away.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(endpoint);
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const list = applyFilter((data.sessions ?? []) as T[]);
        setAllSessions(list);
        if (autoResume) {
          const resumable = [...list]
            .filter((s) => s.runStatus === "running" || (!s.complete && s.messages.length > 0))
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
          if (resumable) openSession(resumable);
        }
      } catch {
        // Ignore -- the page still works, just without an auto-resumed chat.
      }
    })();
    return () => {
      cancelled = true;
    };
    // openSession/applyFilter are stable enough; re-running only on endpoint
    // change is intentional (one bootstrap per mounted tool).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  // Tear down the poll interval on unmount.
  useEffect(() => stopPolling, [stopPolling]);

  return {
    allSessions,
    setAllSessions,
    session,
    setSession,
    sessionId,
    input,
    setInput,
    loading,
    running,
    error,
    setError,
    send,
    openSession,
    startFresh,
    refreshLists,
  };
}
