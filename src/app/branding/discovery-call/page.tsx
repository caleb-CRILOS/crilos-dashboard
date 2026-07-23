"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  MessageCircle,
  Palette,
  Plus,
  Trash2,
} from "lucide-react";
import { HawkSession } from "@/lib/types";
import { computeDiscoveryCallHealth } from "@/lib/hawk/discoveryCallHealth";
import ChatMessages from "@/components/ChatMessages";
import ChatInputRow from "@/components/ChatInputRow";
import DmHealthBadge from "@/components/DmHealthBadge";
import { useAgentChat } from "@/hooks/useAgentChat";

const STAGE_LABELS: Record<string, string> = {
  "Gathering Info": "Gathering Info",
  "Prep Ready": "Prep Ready",
  "Call Completed": "Call Completed",
};

export default function DiscoveryCallPage() {
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
  } = useAgentChat<HawkSession>({
    endpoint: "/api/discovery-call/message",
    transport: "form",
  });
  const [view, setView] = useState<"list" | "chat">("list");
  const [newLeadLabel, setNewLeadLabel] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [markCompletedBusy, setMarkCompletedBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = session?.messages ?? [];
  const sessionHealth = session ? computeDiscoveryCallHealth(session) : undefined;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, loading]);

  function handleStartNewLead() {
    const label = newLeadLabel.trim();
    if (!label || loading) return;
    setNewLeadLabel("");
    startFresh();
    setView("chat");
    send({ message: "", fields: { leadLabel: label } });
  }

  function openThread(s: HawkSession) {
    openSession(s);
    setView("chat");
  }

  function handleSend() {
    const text = input.trim();
    if ((!text && !attachedFile) || loading) return;
    setInput("");
    const file = attachedFile;
    setAttachedFile(null);
    send({ message: text, file });
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

  async function confirmDelete(id: string) {
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/discovery-call/message?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete this lead.");
        return;
      }
      setAllSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setDeleteBusy(false);
      setDeletingId(null);
    }
  }

  async function markCallCompleted() {
    if (!sessionId || markCompletedBusy) return;
    setMarkCompletedBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/discovery-call/message", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update status.");
        return;
      }
      setSession(data.session);
      refreshLists();
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setMarkCompletedBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="label-mono mb-2 flex items-center gap-2 text-[13px] text-electric">
        <Palette size={14} />
        Build / Sales Conversion / Discovery Call
      </div>
      <h1 className="bleed-type text-paper">Discovery Call</h1>
      <p className="mt-1 text-sm text-paper-dim">
        Start a new lead, tell Atlas what you know about the upcoming call
        (or attach a document), and get a Discovery Call Prep Sheet — recommended
        questions organized into a logical call flow, drafted by Hawk and
        voice-checked by Echo.
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
            <h2 className="font-display text-base font-semibold text-paper">
              Start a new Discovery Call Lead
            </h2>
            <p className="mt-1 text-sm text-paper-dim">
              Give this lead a short label so you can find it again — their
              name, business, or where they came from.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={newLeadLabel}
                onChange={(e) => setNewLeadLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleStartNewLead();
                  }
                }}
                disabled={loading}
                placeholder="e.g. Jane — referred by a past client"
                className="flex-1 field disabled:opacity-50"
              />
              <button
                onClick={handleStartNewLead}
                disabled={loading || !newLeadLabel.trim()}
                className="label-mono flex items-center gap-1.5 btn-accent px-3 py-2 text-[13px] disabled:opacity-40"
              >
                <Plus size={15} />
                Start
              </button>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="font-display mb-3 text-lg font-semibold text-paper">
              Lead Conversion
            </h2>
            {allSessions.length === 0 ? (
              <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
                No Discovery Call leads yet. Start one above.
              </div>
            ) : (
              <div className="hud-panel stack space-y-2 p-3">
                {[...allSessions]
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .map((s) => {
                    const health = computeDiscoveryCallHealth(s);
                    return deletingId === s.id ? (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded-sm border border-gold/60 bg-ink-raised px-4 py-3 text-sm"
                      >
                        <span className="text-paper-dim">
                          Delete &quot;{s.leadLabel}&quot;? This can&apos;t be undone.
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => confirmDelete(s.id)}
                            disabled={deleteBusy}
                            className="label-mono rounded-sm border border-gold px-2.5 py-1 text-[13px] text-gold hover:bg-gold/10 disabled:opacity-50"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            disabled={deleteBusy}
                            className="label-mono rounded-sm border border-line-strong px-2.5 py-1 text-[13px] text-paper-dim hover:bg-paper/5 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </span>
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
                          {s.leadLabel}
                          <span className="text-paper-faint">— {s.clientLabel}</span>
                        </button>
                        <span className="flex items-center gap-2">
                          {health && <DmHealthBadge status={health} />}
                          {s.stage && (
                            <span className="label-mono rounded-sm border border-line-strong px-2 py-0.5 text-[13px] text-paper-dim">
                              {STAGE_LABELS[s.stage] ?? s.stage}
                            </span>
                          )}
                          {s.deliverable && (
                            <a
                              href={`/api/hawk/deliverables/${s.deliverable.fileName}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`View prep sheet for ${s.leadLabel}`}
                              className="chip-accent-icon rounded-sm p-1.5"
                            >
                              <Download size={15} />
                            </a>
                          )}
                          <button
                            onClick={() => setDeletingId(s.id)}
                            aria-label={`Delete lead ${s.leadLabel}`}
                            className="chip-accent-icon rounded-sm p-1.5 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={15} />
                          </button>
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="hud-panel hud-panel-magenta stack mt-6 flex h-[560px] flex-col">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <div className="flex items-center gap-3">
                <button
                  onClick={backToList}
                  className="label-mono flex items-center gap-1.5 text-[13px] text-paper-dim hover:text-paper"
                >
                  <ArrowLeft size={14} />
                  All Discovery Call leads
                </button>
                <button
                  onClick={handleNewSession}
                  className="label-mono flex items-center gap-1.5 text-[13px] text-paper-dim hover:text-paper"
                >
                  <Plus size={14} />
                  New session
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-paper-dim">
                {session?.leadLabel}
                {sessionHealth && <DmHealthBadge status={sessionHealth} />}
                {session?.stage && (
                  <span className="label-mono rounded-sm border border-line-strong px-2 py-0.5 text-[13px] text-paper-dim">
                    {STAGE_LABELS[session.stage] ?? session.stage}
                  </span>
                )}
                {session?.stage === "Prep Ready" && (
                  <button
                    onClick={markCallCompleted}
                    disabled={markCompletedBusy}
                    className="label-mono flex items-center gap-1 rounded-sm border border-sage px-2 py-0.5 text-[13px] text-sage hover:bg-sage/10 disabled:opacity-50"
                  >
                    <Check size={12} />
                    Mark call completed
                  </button>
                )}
              </div>
            </div>

            <ChatMessages
              messages={messages}
              loading={loading}
              loadingLabel="Thinking…"
              personaName="Atlas"
              scrollRef={scrollRef}
              uploadsBasePath="/api/hawk/uploads"
            />

            <ChatInputRow
              value={input}
              onChange={setInput}
              onSend={handleSend}
              disabled={loading}
              placeholder="Tell Atlas what you know about this call..."
              attachedFile={attachedFile}
              onFileSelect={setAttachedFile}
              onClearFile={() => setAttachedFile(null)}
            />
          </div>

          {session?.complete && session.deliverable && (
            <div className="mt-4 flex items-center justify-between border-l-[3px] border-sage bg-ink-raised p-4 text-sm">
              <span className="label-mono text-xs text-sage">
                Prep sheet ready — {session.deliverable.title}
              </span>
              <a
                href={`/api/hawk/deliverables/${session.deliverable.fileName}`}
                target="_blank"
                rel="noreferrer"
                className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
              >
                <Download size={14} />
                View PDF
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
