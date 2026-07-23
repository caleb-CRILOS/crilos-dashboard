"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Download, FileText, Play, Plus, Search, Trash2 } from "lucide-react";
import { VideoAdSession } from "@/lib/types";
import ChatMessages from "@/components/ChatMessages";
import ChatInputRow from "@/components/ChatInputRow";
import { useAgentChat } from "@/hooks/useAgentChat";

export default function VideoAdFrameworkPage() {
  const { session, allSessions, setAllSessions, input, setInput, loading, error, setError, send, startFresh } =
    useAgentChat<VideoAdSession>({
      endpoint: "/api/video-ad/message",
      autoResume: true,
    });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const started = session !== null || loading;
  const messages = session?.messages ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, loading]);

  async function confirmDelete(id: string) {
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/video-ad/message?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete this document.");
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

  function handleStart() {
    send({ message: "" });
  }

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    send({ message: text });
  }

  function handleNewScript() {
    startFresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="label-mono mb-2 flex items-center gap-2 text-[13px] text-electric">
        <Search size={14} />
        Build / Lead Generation / Video Ad Framework
      </div>
      <h1 className="bleed-type text-paper">
        Video Ad Framework
      </h1>
      <p className="mt-1 text-sm text-paper-dim">
        A conversation that greets you, proposes Dog Whistle hook candidates
        from your ICA, then drafts a full 9-step, timing-boxed video ad
        script in your own voice.
      </p>

      {error && (
        <div className="mt-4 flex items-center gap-2 border-l-[3px] border-gold bg-ink-raised px-4 py-3 text-sm text-gold">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!started ? (
        <div className="hud-panel hud-panel-magenta stack mt-6 flex h-[520px] flex-col items-center justify-center p-8 text-center">
          <h2 className="font-display text-lg font-semibold text-paper">
            Start a new video ad script
          </h2>
          <p className="mt-2 max-w-sm text-sm text-paper-dim">
            Get a greeting, a Dog Whistle hook to pick from, and a finished
            9-step script — hook, promise, value bomb, credibility, problem,
            why solutions fail, solution, why it works, and CTA.
          </p>

          <button
            onClick={handleStart}
            className="label-mono mt-6 flex items-center gap-2 btn-accent px-4 py-2 text-[13px]"
          >
            <Play size={15} />
            Start Video Ad Framework
          </button>
        </div>
      ) : (
        <div className="hud-panel hud-panel-magenta stack mt-6 flex h-[520px] flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="label-mono text-[13px] text-paper-dim">{session?.clientLabel}</div>
            <button
              onClick={handleNewScript}
              className="label-mono flex items-center gap-1.5 text-[13px] text-paper-dim hover:text-paper"
            >
              <Plus size={14} />
              New session
            </button>
          </div>
          <ChatMessages
            messages={messages}
            loading={loading}
            loadingLabel="Thinking…"
            personaName="CRILOS"
            scrollRef={scrollRef}
          />

          <ChatInputRow
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={loading}
            placeholder="Type your reply..."
          />
        </div>
      )}

      {session?.complete && (
        <div className="mt-4 flex items-center justify-between border-l-[3px] border-sage bg-ink-raised px-4 py-3 text-sm text-sage">
          <span>Script complete — ready in Repository below.</span>
          <button
            onClick={handleNewScript}
            className="label-mono rounded-sm border border-sage px-3 py-1 text-[13px] hover:bg-sage/10"
          >
            Draft another
          </button>
        </div>
      )}

      <div className="mt-10">
        <h2 className="font-display mb-3 text-lg font-semibold text-paper">
          Repository
        </h2>
        <p className="mb-3 text-sm text-paper-dim">
          Finished scripts from every Video Ad Framework session, newest last.
        </p>
        {allSessions.every((s) => !s.deliverable) ? (
          <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
            No scripts drafted yet. They&apos;ll show up here once a
            conversation wraps up.
          </div>
        ) : (
          <div className="hud-panel stack space-y-2 p-3">
            {allSessions
              .filter((s) => s.deliverable)
              .map((s) =>
                deletingId === s.id ? (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-sm border border-gold/60 bg-ink-raised px-4 py-3 text-sm"
                  >
                    <span className="text-paper-dim">
                      Delete &quot;{s.deliverable!.title}&quot;? This can&apos;t be undone.
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => confirmDelete(s.id)}
                        disabled={deleteBusy}
                        className="label-mono rounded-sm border border-gold px-3 py-1 text-[13px] text-gold hover:bg-gold/10 disabled:opacity-50"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        disabled={deleteBusy}
                        className="label-mono rounded-sm border border-line-strong px-3 py-1 text-[13px] text-paper-dim hover:bg-paper/5 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-sm border border-line-strong bg-ink px-4 py-3 text-sm hover:border-electric"
                  >
                    <span className="flex items-center gap-2 text-paper-dim">
                      <FileText size={16} className="text-electric" />
                      {s.deliverable!.title}
                      <span className="text-paper-faint">
                        — {s.clientLabel} · {s.script.platform || "?"}
                      </span>
                    </span>
                    <div className="ml-3 flex shrink-0 items-center gap-2">
                      <a
                        href={`/api/video-ad/deliverables/${s.deliverable!.fileName}`}
                        target="_blank"
                        rel="noreferrer"
                        className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
                      >
                        <Download size={14} />
                        View PDF
                      </a>
                      <button
                        onClick={() => setDeletingId(s.id)}
                        aria-label={`Delete ${s.deliverable!.title}`}
                        className="chip-accent-icon rounded-sm p-1.5"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ),
              )}
          </div>
        )}
      </div>
    </div>
  );
}
