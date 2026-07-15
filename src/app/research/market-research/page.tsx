"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Download, FileCode2, MessageCircle, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { SageSession } from "@/lib/types";
import ChatMessages from "@/components/ChatMessages";
import ChatInputRow from "@/components/ChatInputRow";
import { useAgentChat } from "@/hooks/useAgentChat";

export default function MarketResearchPage() {
  const {
    session,
    setSession,
    sessionId,
    allSessions,
    setAllSessions,
    input,
    setInput,
    loading,
    error,
    setError,
    send,
    openSession,
    startFresh,
    refreshLists,
  } = useAgentChat<SageSession>({ endpoint: "/api/sage/message" });
  const [view, setView] = useState<"list" | "chat">("list");
  const [newTopic, setNewTopic] = useState("");
  const [exportingDoc, setExportingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deleteDocBusy, setDeleteDocBusy] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [deleteThreadBusy, setDeleteThreadBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = session?.messages ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, loading]);

  function handleStartNewTopic() {
    const topic = newTopic.trim();
    if (!topic || loading) return;
    setNewTopic("");
    startFresh();
    setView("chat");
    send({ message: "", fields: { topic } });
  }

  function openThread(s: SageSession) {
    openSession(s);
    setView("chat");
  }

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    send({ message: text });
  }

  function backToList() {
    setView("list");
    setError(null);
    refreshLists();
  }

  function handleNewSession() {
    startFresh();
    setView("list");
  }

  async function handleExportBrandedDoc() {
    if (!sessionId) return;
    setExportingDoc(true);
    setError(null);
    try {
      const res = await fetch("/api/sage/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, format: "html" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create the branded doc.");
        return;
      }
      setSession(data.session);
      refreshLists();
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setExportingDoc(false);
    }
  }

  async function confirmDeleteBrandedDoc(id: string) {
    setDeleteDocBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sage/export?id=${encodeURIComponent(id)}&format=html`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete this doc.");
        return;
      }
      setAllSessions((prev) => prev.map((s) => (s.id === id ? { ...s, brandedDoc: undefined } : s)));
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setDeleteDocBusy(false);
      setDeletingDocId(null);
    }
  }

  async function confirmDeleteThread(id: string) {
    setDeleteThreadBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sage/message?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete this thread.");
        return;
      }
      setAllSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setDeleteThreadBusy(false);
      setDeletingThreadId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="label-mono mb-2 flex items-center gap-2 text-[12px] text-electric">
        <Search size={14} />
        Build / Lead Generation / Market Research
      </div>
      <h1 className="bleed-type text-paper">
        Market Research
      </h1>
      <p className="mt-1 text-sm text-paper-dim">
        Market and competitor intel, fact-finding, and discovery-call prep —
        filtered through a client&apos;s specific niche and ideal client
        avatar, with live web search, not generic industry information.
      </p>

      {error && (
        <div className="mt-4 flex items-center gap-2 border-l-[3px] border-gold bg-ink-raised px-4 py-3 text-sm text-gold">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {view === "list" ? (
        <div className="mt-6">
          <div className="hud-panel hud-panel-magenta stack p-5">
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-paper">
              Start a new research thread
            </h2>
            <p className="mt-1 text-sm text-paper-dim">
              Give this thread a short topic so you can find it again — a
              competitor name, a market question, whatever you&apos;re
              digging into.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleStartNewTopic();
                  }
                }}
                disabled={loading}
                placeholder="e.g. Competitor teardown — Acme Coaching"
                className="flex-1 field disabled:opacity-50"
              />
              <button
                onClick={handleStartNewTopic}
                disabled={loading || !newTopic.trim()}
                className="label-mono flex items-center gap-1.5 btn-accent px-3 py-2 text-[12px] disabled:opacity-40"
              >
                <Plus size={15} />
                Start
              </button>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="font-display mb-3 text-lg font-bold uppercase tracking-wide text-paper">
              Research threads
            </h2>
            {allSessions.length === 0 ? (
              <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
                No research threads yet. Start one above.
              </div>
            ) : (
              <div className="hud-panel stack space-y-2 p-3">
                {[...allSessions]
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .map((s) =>
                    deletingThreadId === s.id ? (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded-sm border border-gold/60 bg-ink-raised px-4 py-3 text-sm"
                      >
                        <span className="text-paper-dim">
                          Delete &quot;{s.topic}&quot;? This can&apos;t be undone.
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => confirmDeleteThread(s.id)}
                            disabled={deleteThreadBusy}
                            className="label-mono rounded-sm border border-gold px-3 py-1 text-[11px] text-gold hover:bg-gold/10 disabled:opacity-50"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeletingThreadId(null)}
                            disabled={deleteThreadBusy}
                            className="label-mono rounded-sm border border-line-strong px-3 py-1 text-[11px] text-paper-dim hover:bg-paper/5 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={s.id}
                        className="group flex w-full items-center justify-between rounded-sm border border-line-strong bg-ink px-4 py-3 text-left text-sm hover:border-electric"
                      >
                        <button
                          onClick={() => openThread(s)}
                          className="flex flex-1 items-center gap-2 text-paper-dim"
                        >
                          <MessageCircle size={16} className="text-electric" />
                          {s.topic}
                          <span className="text-paper-faint">— {s.clientLabel}</span>
                        </button>
                        <button
                          onClick={() => setDeletingThreadId(s.id)}
                          aria-label={`Delete thread "${s.topic}"`}
                          className="chip-accent-icon rounded-sm p-1.5 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ),
                  )}
              </div>
            )}
          </div>

          <div className="mt-10">
            <h2 className="font-display mb-3 text-lg font-bold uppercase tracking-wide text-paper">
              Repository
            </h2>
            <p className="mb-3 text-sm text-paper-dim">
              Every exported on-brand research doc, newest last. Deleting an entry here only
              removes that file — the thread stays in Research Threads and can be re-exported anytime.
            </p>
            {allSessions.every((s) => !s.brandedDoc) ? (
              <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
                Nothing exported yet. Open a thread and export an on-brand doc once you&apos;re
                ready to save it.
              </div>
            ) : (
              <div className="hud-panel stack space-y-2 p-3">
                {allSessions
                  .filter((s) => s.brandedDoc)
                  .map((s) =>
                    deletingDocId === s.id ? (
                      <div
                        key={`${s.id}-doc`}
                        className="flex items-center justify-between gap-3 rounded-sm border border-gold/60 bg-ink-raised px-4 py-3 text-sm"
                      >
                        <span className="text-paper-dim">
                          Delete the branded doc for &quot;{s.brandedDoc!.title}&quot;? The research
                          thread stays in Research Threads — you can re-export anytime.
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => confirmDeleteBrandedDoc(s.id)}
                            disabled={deleteDocBusy}
                            className="label-mono rounded-sm border border-gold px-3 py-1 text-[11px] text-gold hover:bg-gold/10 disabled:opacity-50"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeletingDocId(null)}
                            disabled={deleteDocBusy}
                            className="label-mono rounded-sm border border-line-strong px-3 py-1 text-[11px] text-paper-dim hover:bg-paper/5 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={`${s.id}-doc`}
                        className="flex items-center justify-between rounded-sm border border-line-strong bg-ink px-4 py-3 text-sm hover:border-electric"
                      >
                        <span className="flex items-center gap-2 text-paper-dim">
                          <FileCode2 size={16} className="text-electric" />
                          {s.brandedDoc!.title}
                          <span className="text-paper-faint">
                            — {s.clientLabel} · on-brand HTML
                          </span>
                        </span>
                        <div className="ml-3 flex shrink-0 items-center gap-2">
                          <a
                            href={`/api/sage/deliverables/${s.brandedDoc!.fileName}`}
                            target="_blank"
                            rel="noreferrer"
                            className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
                          >
                            <Download size={14} />
                            View doc
                          </a>
                          <button
                            onClick={() => setDeletingDocId(s.id)}
                            className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    ),
                  )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hud-panel hud-panel-magenta stack mt-6 flex h-[560px] flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-3">
              <button
                onClick={backToList}
                className="label-mono flex items-center gap-1.5 text-[12px] text-paper-dim hover:text-paper"
              >
                <ArrowLeft size={14} />
                All research threads
              </button>
              <button
                onClick={handleNewSession}
                className="label-mono flex items-center gap-1.5 text-[12px] text-paper-dim hover:text-paper"
              >
                <Plus size={14} />
                New session
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-paper-dim">{session?.topic}</div>
              <button
                onClick={handleExportBrandedDoc}
                disabled={loading || exportingDoc || !sessionId}
                className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px] disabled:opacity-40"
              >
                <Sparkles size={14} />
                {exportingDoc ? "Designing…" : "Export"}
              </button>
            </div>
          </div>

          <ChatMessages
            messages={messages}
            loading={loading}
            loadingLabel="Researching…"
            personaName="Sage"
            scrollRef={scrollRef}
          />

          <ChatInputRow
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={loading}
            placeholder="Ask Sage anything about this topic..."
          />
        </div>
      )}
    </div>
  );
}
