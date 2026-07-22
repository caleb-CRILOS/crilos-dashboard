"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Download,
  FileText,
  Image as ImageIcon,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { DigitalProductSession } from "@/lib/types";
import ChatMessages from "@/components/ChatMessages";
import ChatInputRow from "@/components/ChatInputRow";
import { useAgentChat } from "@/hooks/useAgentChat";

const FORMAT_LABELS: Record<string, string> = {
  docx: "Word",
  pdf: "PDF",
};

function formatLabel(fileName: string): string {
  const ext = fileName.split(".").pop() ?? "";
  return FORMAT_LABELS[ext] ?? ext.toUpperCase();
}

export default function DigitalProductBuilderPage() {
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
    startFresh,
  } = useAgentChat<DigitalProductSession>({
    endpoint: "/api/digital-product/message",
    transport: "form",
    autoResume: true,
  });
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  // Rendered cover file name per session (overlays asset.coverImageFileName
  // once a fresh render returns), a cache-buster so a regenerated cover /
  // PDF actually refreshes, and which row is currently rendering.
  const [coverBySession, setCoverBySession] = useState<Record<string, string | null>>({});
  const [coverBgBySession, setCoverBgBySession] = useState<Record<string, string | null>>({});
  const [coverBustBySession, setCoverBustBySession] = useState<Record<string, number>>({});
  const [coverBusyId, setCoverBusyId] = useState<string | null>(null);
  const [aiOpenId, setAiOpenId] = useState<string | null>(null);
  const [aiPromptBySession, setAiPromptBySession] = useState<Record<string, string>>({});
  // Whether a fal.ai key is configured (gates the optional AI-background action).
  const [falKeySet, setFalKeySet] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // A conversation is on screen once one has been started or resumed.
  const started = session !== null || loading;
  const messages = session?.messages ?? [];
  const products = allSessions.filter((s) => s.deliverable);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, loading]);

  useEffect(() => {
    // Learn whether a fal.ai key is set so we only show the AI-background
    // action when it can actually work.
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setFalKeySet(Boolean(d.settings?._hasFalApiKey)))
      .catch(() => {});
  }, []);

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

  function handleNewProduct() {
    startFresh();
  }

  async function postCover(
    sessionId: string,
    opts: { mode?: "render" | "ai" | "upload" | "remove-bg"; prompt?: string; file?: File } = {},
  ) {
    setCoverBusyId(sessionId);
    setError(null);
    try {
      const form = new FormData();
      form.set("sessionId", sessionId);
      if (opts.mode) form.set("mode", opts.mode);
      if (opts.prompt) form.set("prompt", opts.prompt);
      if (opts.file) form.set("file", opts.file);
      const res = await fetch("/api/digital-product/cover", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update the cover.");
        return;
      }
      setCoverBySession((m) => ({ ...m, [sessionId]: data.coverImageFileName }));
      setCoverBgBySession((m) => ({ ...m, [sessionId]: data.coverBackgroundFileName ?? null }));
      setCoverBustBySession((m) => ({ ...m, [sessionId]: Date.now() }));
      setAiOpenId(null);
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setCoverBusyId(null);
    }
  }

  async function confirmDelete(id: string) {
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/digital-product/message?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete this product.");
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

  async function handleDeleteAll() {
    setDeleteAllBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/digital-product/message?all=true", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete products.");
        return;
      }
      setAllSessions((prev) => prev.filter((s) => !s.complete));
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setDeleteAllBusy(false);
      setConfirmDeleteAll(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="label-mono mb-2 flex items-center gap-2 text-[12px] text-electric">
        <BookOpen size={14} />
        Build / Lead Generation / Digital Product Builder
      </div>
      <h1 className="bleed-type text-paper">Digital Product Builder</h1>
      <p className="mt-1 text-sm text-paper-dim">
        A conversation with Quill that turns your content bible into a
        finished digital product — an ebook, workbook, checklist, whatever
        fits — grounded in your actual goals and the resources already on
        file. Echo reviews it before you get a branded Word or PDF file.
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
            Start a new digital product
          </h2>
          <p className="mt-2 max-w-sm text-sm text-paper-dim">
            Quill will pitch four ideas grounded in your content bible, then
            walk through a brief, an outline you can revise, and a full
            draft — reviewed by Echo before it&apos;s finished.
          </p>

          <button
            onClick={handleStart}
            className="label-mono mt-6 flex items-center gap-2 btn-accent px-4 py-2 text-[12px]"
          >
            <Play size={15} />
            Start Digital Product Builder
          </button>
        </div>
      ) : (
        <div className="hud-panel hud-panel-magenta stack mt-6 flex h-[520px] flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="label-mono text-[12px] text-paper-dim">{session?.clientLabel}</div>
            <button
              onClick={handleNewProduct}
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
            personaName="Quill"
            scrollRef={scrollRef}
            uploadsBasePath="/api/digital-product/uploads"
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
        <div className="mt-4 flex items-center justify-between border-l-[3px] border-sage bg-ink-raised px-4 py-3 text-sm text-sage">
          <span>
            Product complete — {session.asset.title || "your draft"} is
            ready below.
          </span>
          <button
            onClick={handleNewProduct}
            className="label-mono rounded-sm border border-sage px-3 py-1 text-[11px] hover:bg-sage/10"
          >
            Build another
          </button>
        </div>
      )}

      <div className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-paper">
            Digital products
          </h2>
          {products.length > 0 && (
            <button
              onClick={() => setConfirmDeleteAll(true)}
              className="label-mono flex items-center gap-1.5 rounded-sm border border-line-strong px-3 py-1.5 text-[11px] text-paper-dim hover:border-gold hover:text-gold"
            >
              <Trash2 size={14} />
              Delete all products
            </button>
          )}
        </div>
        <p className="mb-3 text-sm text-paper-dim">
          Finished products from every Digital Product Builder session, newest last.
        </p>
        {products.length === 0 ? (
          <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
            No products built yet. They&apos;ll show up here once a
            conversation wraps up.
          </div>
        ) : (
          <div className="hud-panel stack space-y-2 p-3">
            {products.map((s) =>
              deletingId === s.id ? (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-sm border border-gold/60 bg-ink-raised px-4 py-3 text-sm"
                >
                  <span className="text-paper-dim">
                    Delete {s.deliverable!.title}? This can&apos;t be undone.
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
                (() => {
                  const cover =
                    coverBySession[s.id] !== undefined
                      ? coverBySession[s.id]
                      : s.asset.coverImageFileName ?? null;
                  const bg =
                    coverBgBySession[s.id] !== undefined
                      ? coverBgBySession[s.id]
                      : s.asset.coverBackgroundFileName ?? null;
                  const coverBust = coverBustBySession[s.id];
                  const busy = coverBusyId === s.id;
                  const isPdf = formatLabel(s.deliverable!.fileName) === "PDF";
                  const viewHref = `/api/digital-product/deliverables/${s.deliverable!.fileName}${
                    coverBust ? `?t=${coverBust}` : ""
                  }`;
                  return (
                    <div
                      key={s.deliverable!.fileName}
                      className="rounded-sm border border-line-strong bg-ink px-4 py-3 text-sm hover:border-electric"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2 text-paper-dim">
                            <FileText size={16} className="shrink-0 text-electric" />
                            <span className="truncate">{s.deliverable!.title}</span>
                          </div>
                          <div className="mt-0.5 truncate text-[12px] text-paper-faint">
                            {s.clientLabel} · {s.asset.productType || "?"}
                          </div>
                        </div>
                        <button
                          onClick={() => setDeletingId(s.id)}
                          aria-label="Delete product"
                          className="shrink-0 rounded-sm p-1.5 text-paper-faint hover:bg-ink-elevated hover:text-paper"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => postCover(s.id, { mode: "render" })}
                          disabled={busy}
                          className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px] disabled:opacity-50"
                        >
                          <ImageIcon size={14} />
                          {busy ? "Working…" : `${cover ? "Regenerate" : "Generate"} cover`}
                        </button>
                        {falKeySet && (
                          <button
                            onClick={() => setAiOpenId(aiOpenId === s.id ? null : s.id)}
                            disabled={busy}
                            className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px] disabled:opacity-50"
                          >
                            <Sparkles size={14} />
                            AI background
                          </button>
                        )}
                        <label
                          className={`chip-accent flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[11px] ${
                            busy ? "opacity-50" : ""
                          }`}
                        >
                          <Upload size={14} />
                          Upload background
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            disabled={busy}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) postCover(s.id, { mode: "upload", file: f });
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {bg && (
                          <button
                            onClick={() => postCover(s.id, { mode: "remove-bg" })}
                            disabled={busy}
                            className="label-mono flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-gold hover:underline disabled:opacity-50"
                          >
                            Remove background
                          </button>
                        )}
                        {cover && (
                          <a
                            href={`/api/digital-product/deliverables/${cover}${
                              coverBust ? `?t=${coverBust}` : ""
                            }`}
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
                          >
                            <Download size={14} />
                            Download cover
                          </a>
                        )}
                        <a
                          href={viewHref}
                          target="_blank"
                          rel="noreferrer"
                          className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
                        >
                          <Download size={14} />
                          {isPdf ? "View" : "Download"}
                        </a>
                      </div>

                      {aiOpenId === s.id && falKeySet && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={aiPromptBySession[s.id] ?? ""}
                            onChange={(e) =>
                              setAiPromptBySession((m) => ({ ...m, [s.id]: e.target.value }))
                            }
                            placeholder="Optional: describe the background (e.g. 'warm sunrise gradient')"
                            className="min-w-0 flex-1 rounded-sm border border-line-strong bg-ink-raised px-3 py-1.5 text-[12px] text-paper placeholder:text-paper-faint focus:border-electric focus:outline-none"
                          />
                          <button
                            onClick={() =>
                              postCover(s.id, { mode: "ai", prompt: aiPromptBySession[s.id] })
                            }
                            disabled={busy}
                            className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px] disabled:opacity-50"
                          >
                            <Sparkles size={14} />
                            {busy ? "Generating…" : "Generate background"}
                          </button>
                        </div>
                      )}

                      {cover && (
                        <div className="mt-3 flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/digital-product/deliverables/${cover}${
                              coverBust ? `?t=${coverBust}` : ""
                            }`}
                            alt="Cover"
                            className="h-28 w-auto shrink-0 rounded-sm border border-line-strong"
                          />
                          <div className="text-[12px] text-paper-faint">
                            {isPdf
                              ? "Added as page 1 of the PDF."
                              : "Standalone cover — download above."}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ),
            )}
          </div>
        )}
      </div>

      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4">
          <div className="hud-panel stack w-full max-w-sm border-l-[3px] border-gold p-5">
            <h3 className="font-display text-base font-bold uppercase tracking-wide text-paper">
              Delete all products?
            </h3>
            <p className="mt-2 text-sm text-paper-dim">
              This permanently deletes all {products.length} finished product
              {products.length === 1 ? "" : "s"}. This can&apos;t be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteAll(false)}
                disabled={deleteAllBusy}
                className="label-mono rounded-sm border border-line-strong px-3 py-1.5 text-[11px] text-paper-dim hover:bg-paper/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleteAllBusy}
                className="label-mono rounded-sm border border-gold px-3 py-1.5 text-[11px] text-gold hover:bg-gold/10 disabled:opacity-50"
              >
                {deleteAllBusy ? "Deleting…" : "Delete all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
