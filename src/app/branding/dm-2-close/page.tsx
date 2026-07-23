"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Check, MessageCircle, Palette, Plus, Trash2, X } from "lucide-react";
import { DmSession } from "@/lib/types";
import { computeLeadHealth } from "@/lib/dm2close/health";
import DmHealthBadge from "@/components/DmHealthBadge";
import ChatMessages from "@/components/ChatMessages";
import ChatInputRow from "@/components/ChatInputRow";
import { useAgentChat } from "@/hooks/useAgentChat";

export default function Dm2ClosePage() {
  const {
    session,
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
  } = useAgentChat<DmSession>({ endpoint: "/api/dm-2-close/message" });
  const [view, setView] = useState<"list" | "chat">("list");
  const [newLeadLabel, setNewLeadLabel] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = session?.messages ?? [];
  const currentHealth = computeLeadHealth(messages);

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

  function openThread(s: DmSession) {
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

  async function confirmDelete(id: string, converted: boolean) {
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dm-2-close/message?id=${encodeURIComponent(id)}&converted=${converted}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete this conversation.");
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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="label-mono mb-2 flex items-center gap-2 text-[13px] text-electric">
        <Palette size={14} />
        Build / Sales Conversion / DM 2 Close
      </div>
      <h1 className="bleed-type text-paper">
        DM 2 Close
      </h1>
      <p className="mt-1 text-sm text-paper-dim">
        A live reply assistant for DM lead conversations — reads the
        current state of a thread, proposes which of the 5 stages
        (Respond, Relate, Assess, Frame, Ask) it&apos;s in, and drafts the
        next message in your voice.
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
              Start a new lead conversation
            </h2>
            <p className="mt-1 text-sm text-paper-dim">
              Give this thread a short label so you can find it again — the
              lead&apos;s handle, name, or where they came from.
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
                placeholder="e.g. @janedoe — IG comment reply"
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
              Lead conversations
            </h2>
            {allSessions.length === 0 ? (
              <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
                No lead conversations yet. Start one above.
              </div>
            ) : (
              <div className="hud-panel stack space-y-2 p-3">
                {[...allSessions]
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .map((s) => {
                    const health = computeLeadHealth(s.messages);
                    return deletingId === s.id ? (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 border-l-[3px] border-clay bg-clay/10 px-4 py-3 text-sm"
                      >
                        <span className="text-paper">
                          Deleting &quot;{s.leadLabel}&quot; — did this lead to a
                          sale, new client, or other conversion?
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => confirmDelete(s.id, true)}
                            disabled={deleteBusy}
                            className="label-mono flex items-center gap-1 rounded-sm border border-sage px-2.5 py-1 text-[13px] text-sage hover:bg-sage/10 disabled:opacity-50"
                          >
                            <Check size={13} />
                            Yes
                          </button>
                          <button
                            onClick={() => confirmDelete(s.id, false)}
                            disabled={deleteBusy}
                            className="label-mono flex items-center gap-1 rounded-sm border border-line-strong px-2.5 py-1 text-[13px] text-paper hover:bg-ink-elevated disabled:opacity-50"
                          >
                            <X size={13} />
                            No
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
                          {s.currentStage && (
                            <span className="label-mono rounded-sm border border-line-strong px-2 py-0.5 text-[13px] text-paper-dim">
                              {s.currentStage}
                            </span>
                          )}
                          <button
                            onClick={() => setDeletingId(s.id)}
                            aria-label={`Delete conversation with ${s.leadLabel}`}
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
        <div className="hud-panel hud-panel-magenta stack mt-6 flex h-[560px] flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-3">
              <button
                onClick={backToList}
                className="label-mono flex items-center gap-1.5 text-[13px] text-paper-dim hover:text-paper"
              >
                <ArrowLeft size={14} />
                All lead conversations
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
              {currentHealth && <DmHealthBadge status={currentHealth} />}
              {session?.currentStage && (
                <span className="label-mono rounded-sm border border-line-strong px-2 py-0.5 text-[13px] text-paper-dim">
                  {session.currentStage}
                </span>
              )}
            </div>
          </div>

          <ChatMessages
            messages={messages}
            loading={loading}
            loadingLabel="Thinking…"
            personaName="Quill"
            scrollRef={scrollRef}
          />

          <ChatInputRow
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={loading}
            placeholder="Paste the lead's reply, or the current state of the conversation..."
          />
        </div>
      )}
    </div>
  );
}
