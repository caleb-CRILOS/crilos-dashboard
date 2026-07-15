"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ClipboardList, Download, FileText, Play, Plus, Trash2 } from "lucide-react";
import { StewardSession } from "@/lib/types";
import ChatMessages from "@/components/ChatMessages";
import ChatInputRow from "@/components/ChatInputRow";
import { useAgentChat } from "@/hooks/useAgentChat";

const FORMAT_LABELS: Record<string, string> = {
  docx: "Word",
  pdf: "PDF",
  pptx: "PowerPoint",
  html: "Email HTML",
};

function formatLabel(fileName: string): string {
  const ext = fileName.split(".").pop() ?? "";
  return FORMAT_LABELS[ext] ?? ext.toUpperCase();
}

export default function DocumentOpsPage() {
  const { session, allSessions, setAllSessions, input, setInput, loading, error, setError, send, startFresh } =
    useAgentChat<StewardSession>({
      endpoint: "/api/steward/message",
      transport: "form",
      autoResume: true,
    });
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
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
      const res = await fetch(`/api/steward/message?id=${encodeURIComponent(id)}`, {
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
    if ((!text && !attachedFile) || loading) return;
    setInput("");
    const file = attachedFile;
    setAttachedFile(null);
    send({ message: text, file });
  }

  function handleNewDoc() {
    startFresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="label-mono mb-2 flex items-center gap-2 text-[12px] text-electric">
        <ClipboardList size={14} />
        Build / Efficiency Engine / Document Ops
      </div>
      <h1 className="bleed-type text-paper">
        Document Ops
      </h1>
      <p className="mt-1 text-sm text-paper-dim">
        Onboarding docs, session notes, SOPs, recap emails, and program
        materials — drafted by Steward, matching any existing material on
        file, with a voice-QA pass from Echo on anything client-facing.
      </p>

      {error && (
        <div className="mt-4 flex items-center gap-2 border-l-[3px] border-gold bg-ink-raised px-4 py-3 text-sm text-gold">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!started ? (
        <div className="hud-panel hud-panel-magenta stack mt-6 flex h-[520px] flex-col items-center justify-center p-8 text-center">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-paper">
            Start a new document
          </h2>
          <p className="mt-2 max-w-sm text-sm text-paper-dim">
            Get asked what kind of doc you need and who it&apos;s for, walk
            through a short brief, and get a finished draft.
          </p>

          <button
            onClick={handleStart}
            className="label-mono mt-6 flex items-center gap-2 btn-accent px-4 py-2 text-[12px]"
          >
            <Play size={15} />
            Start Document Ops
          </button>
        </div>
      ) : (
        <div className="hud-panel hud-panel-magenta stack mt-6 flex h-[520px] flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="label-mono text-[12px] text-paper-dim">{session?.clientLabel}</div>
            <button
              onClick={handleNewDoc}
              className="label-mono flex items-center gap-1.5 text-[12px] text-paper-dim hover:text-paper"
            >
              <Plus size={14} />
              New session
            </button>
          </div>
          <ChatMessages
            messages={messages}
            loading={loading}
            loadingLabel="Thinking…"
            personaName="Atlas"
            scrollRef={scrollRef}
          />

          <ChatInputRow
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={loading}
            placeholder="Type your reply..."
            attachedFile={attachedFile}
            onFileSelect={setAttachedFile}
            onClearFile={() => setAttachedFile(null)}
          />
        </div>
      )}

      {session?.complete && (
        <div className="mt-4 border-l-[3px] border-sage bg-ink-raised p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="label-mono text-xs text-sage">
              Doc complete — {session.asset.docType || "your draft"}
              {session.asset.audience ? ` (${session.asset.audience})` : ""}
            </span>
            <button
              onClick={handleNewDoc}
              className="label-mono rounded-sm border border-sage px-3 py-1 text-[11px] text-sage hover:bg-sage/10"
            >
              Draft another
            </button>
          </div>
          <pre className="whitespace-pre-wrap rounded-sm border border-line-strong bg-ink p-3 text-sm text-paper-dim">
            {session.asset.finalText}
          </pre>
        </div>
      )}

      <div className="mt-10">
        <h2 className="font-display mb-3 text-lg font-bold uppercase tracking-wide text-paper">
          Repository
        </h2>
        <p className="mb-3 text-sm text-paper-dim">
          Every finished doc from Document Ops, in whatever format it was requested, newest last.
        </p>
        {allSessions.every((s) => !s.deliverable) ? (
          <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
            No docs drafted yet. They&apos;ll show up here once a conversation wraps up.
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
                        className="label-mono rounded-sm border border-gold px-3 py-1 text-[11px] text-gold hover:bg-gold/10 disabled:opacity-50"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        disabled={deleteBusy}
                        className="label-mono rounded-sm border border-line-strong px-3 py-1 text-[11px] text-paper-dim hover:bg-paper/5 disabled:opacity-50"
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
                        — {s.clientLabel} · {formatLabel(s.deliverable!.fileName)}
                      </span>
                    </span>
                    <div className="ml-3 flex shrink-0 items-center gap-2">
                      <a
                        href={`/api/steward/deliverables/${s.deliverable!.fileName}`}
                        target="_blank"
                        rel="noreferrer"
                        className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
                      >
                        <Download size={14} />
                        {formatLabel(s.deliverable!.fileName) === "PDF" ||
                        formatLabel(s.deliverable!.fileName) === "Email HTML"
                          ? "View"
                          : "Download"}
                      </a>
                      <button
                        onClick={() => setDeletingId(s.id)}
                        aria-label={`Delete ${s.deliverable!.title}`}
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
  );
}
