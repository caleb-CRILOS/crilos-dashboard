"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Download,
  FileText,
  Image as ImageIcon,
  Megaphone,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { MessagingSession } from "@/lib/types";
import ChatMessages from "@/components/ChatMessages";
import ChatInputRow from "@/components/ChatInputRow";
import { useAgentChat } from "@/hooks/useAgentChat";

export default function MessagingCreatorPage() {
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
  } = useAgentChat<MessagingSession>({
    endpoint: "/api/messaging/message",
    autoResume: true,
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Rendered slide file names per session (overlays the persisted
  // session.slideFiles once a fresh render returns), plus a cache-buster so
  // regenerated thumbnails actually refresh, and per-action UI state.
  const [slidesBySession, setSlidesBySession] = useState<Record<string, string[]>>({});
  const [bustBySession, setBustBySession] = useState<Record<string, number>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [slidesError, setSlidesError] = useState<string | null>(null);

  // Optional background photo per session (overlays session.slideImageFile;
  // undefined = untouched this session, null = removed). Bust refreshes the
  // thumbnail after an upload.
  const [imageBySession, setImageBySession] = useState<Record<string, string | null>>({});
  const [imageBustBySession, setImageBustBySession] = useState<Record<string, number>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);

  const started = session !== null || loading;
  const messages = session?.messages ?? [];
  const deliverables = allSessions.filter((s) => s.deliverable);

  async function generateSlides(sessionId: string) {
    setGeneratingId(sessionId);
    setSlidesError(null);
    try {
      const res = await fetch("/api/messaging/slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to render slides");
      setSlidesBySession((m) => ({ ...m, [sessionId]: data.slideFiles }));
      setBustBySession((m) => ({ ...m, [sessionId]: Date.now() }));
    } catch (e) {
      setSlidesError(e instanceof Error ? e.message : "Failed to render slides");
    } finally {
      setGeneratingId(null);
    }
  }

  async function uploadImage(sessionId: string, file: File) {
    setUploadingId(sessionId);
    setSlidesError(null);
    try {
      const form = new FormData();
      form.set("sessionId", sessionId);
      form.set("file", file);
      const res = await fetch("/api/messaging/slides/image", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setImageBySession((m) => ({ ...m, [sessionId]: data.slideImageFile }));
      setImageBustBySession((m) => ({ ...m, [sessionId]: Date.now() }));
    } catch (e) {
      setSlidesError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingId(null);
    }
  }

  async function removeImage(sessionId: string) {
    setSlidesError(null);
    try {
      const res = await fetch(`/api/messaging/slides/image?sessionId=${sessionId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Could not remove image");
      }
      setImageBySession((m) => ({ ...m, [sessionId]: null }));
    } catch (e) {
      setSlidesError(e instanceof Error ? e.message : "Could not remove image");
    }
  }

  async function confirmDelete(id: string) {
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/messaging/message?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete this piece.");
        return;
      }
      setAllSessions((prev) => prev.filter((s) => s.id !== id));
      // A piece stays open in the chat above after it completes, so deleting
      // its card would otherwise leave a transcript that no longer exists.
      if (session?.id === id) startFresh();
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
      const res = await fetch("/api/messaging/message?all=true", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete pieces.");
        return;
      }
      setAllSessions((prev) => prev.filter((s) => !s.complete));
      if (session?.complete) startFresh();
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setDeleteAllBusy(false);
      setConfirmDeleteAll(false);
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, loading]);

  function handleStart() {
    send({ message: "" });
  }

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    send({ message: text });
  }

  function handleNewPiece() {
    startFresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="label-mono mb-2 flex items-center gap-2 text-[12px] text-electric">
        <Megaphone size={14} />
        Build / Influence Building / Messaging Creator
      </div>
      <h1 className="bleed-type text-paper">
        Messaging Creator
      </h1>
      <p className="mt-1 text-sm text-paper-dim">
        A conversation that greets you, proposes four content ideas from
        your content bible, then drafts whichever one you pick — IG image
        script, carousel script, video script, or blog post — in your own
        voice.
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
            Start a new piece of content
          </h2>
          <p className="mt-2 max-w-sm text-sm text-paper-dim">
            Get a greeting, four ready-made ideas, and a finished draft —
            same process as the CRILOS CLI&apos;s messaging-creator skill.
          </p>

          <button
            onClick={handleStart}
            className="label-mono mt-6 flex items-center gap-2 btn-accent px-4 py-2 text-[12px]"
          >
            <Play size={15} />
            Start Messaging Creator
          </button>
        </div>
      ) : (
        <div className="hud-panel hud-panel-magenta stack mt-6 flex h-[520px] flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="label-mono text-[12px] text-paper-dim">{session?.clientLabel}</div>
            <button
              onClick={handleNewPiece}
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
          />
        </div>
      )}

      {session?.complete && (
        <div className="mt-4 flex items-center justify-between border-l-[3px] border-sage bg-ink-raised px-4 py-3 text-sm text-sage">
          <span>
            Piece complete — {session.piece.topic || "your draft"} is ready in
            Deliverables below.
          </span>
          <button
            onClick={handleNewPiece}
            className="label-mono rounded-sm border border-sage px-3 py-1 text-[11px] hover:bg-sage/10"
          >
            Draft another
          </button>
        </div>
      )}

      <div className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-paper">
            Deliverables
          </h2>
          {deliverables.length > 0 && (
            <button
              onClick={() => setConfirmDeleteAll(true)}
              className="label-mono flex items-center gap-1.5 rounded-sm border border-line-strong px-3 py-1.5 text-[11px] text-paper-dim hover:border-gold hover:text-gold"
            >
              <Trash2 size={14} />
              Delete all pieces
            </button>
          )}
        </div>
        <p className="mb-3 text-sm text-paper-dim">
          Finished pieces from every Messaging Creator session, newest last.
        </p>
        {slidesError && (
          <div className="mb-3 flex items-center gap-2 border-l-[3px] border-gold bg-ink-raised px-4 py-2 text-sm text-gold">
            <AlertCircle size={15} />
            {slidesError}
          </div>
        )}
        {deliverables.length === 0 ? (
          <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
            No pieces drafted yet. They&apos;ll show up here once a
            conversation wraps up.
          </div>
        ) : (
          <div className="hud-panel stack space-y-2 p-3">
            {deliverables.map((s) => {
              const format = (s.piece.format || "").toLowerCase();
              const isCarousel = format.includes("carousel");
              const isImage = !isCarousel && format.includes("image");
              const renderable = isCarousel || isImage;
              const noun = isCarousel ? "slides" : "image";
              const slides = slidesBySession[s.id] ?? s.slideFiles ?? [];
              const bust = bustBySession[s.id];
              const attachedImage =
                imageBySession[s.id] !== undefined
                  ? imageBySession[s.id]
                  : s.slideImageFile ?? null;
              const imageBust = imageBustBySession[s.id];

              if (deletingId === s.id) {
                return (
                  <div
                    key={s.deliverable!.fileName}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-gold/60 bg-ink-raised px-4 py-3 text-sm"
                  >
                    <span className="text-paper-dim">
                      Delete &ldquo;{s.deliverable!.title}&rdquo;? The conversation, its
                      PDF{slides.length > 0 ? ", slides" : ""}{" "}
                      and any uploaded image go too. This can&apos;t be undone.
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => confirmDelete(s.id)}
                        disabled={deleteBusy}
                        className="label-mono rounded-sm border border-gold px-3 py-1 text-[11px] text-gold hover:bg-gold/10 disabled:opacity-50"
                      >
                        {deleteBusy ? "Deleting…" : "Delete"}
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
                );
              }

              return (
                <div
                  key={s.deliverable!.fileName}
                  className="rounded-sm border border-line-strong bg-ink px-4 py-3 text-sm hover:border-electric"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2 text-paper-dim">
                      <FileText size={16} className="shrink-0 text-electric" />
                      <span className="truncate">{s.deliverable!.title}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-paper-faint">
                      {s.clientLabel} · {s.piece.format || "?"} / {s.piece.platform || "?"}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {renderable && (
                      <button
                        onClick={() => generateSlides(s.id)}
                        disabled={generatingId === s.id}
                        className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px] disabled:opacity-50"
                      >
                        <ImageIcon size={14} />
                        {generatingId === s.id
                          ? "Rendering…"
                          : `${slides.length ? "Regenerate" : "Generate"} ${noun}`}
                      </button>
                    )}
                    {renderable && (
                      <label
                        className={`chip-accent flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[11px] ${
                          uploadingId === s.id ? "opacity-50" : ""
                        }`}
                      >
                        <ImageIcon size={14} />
                        {uploadingId === s.id
                          ? "Uploading…"
                          : attachedImage
                            ? "Change image"
                            : "Add image"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          disabled={uploadingId === s.id}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadImage(s.id, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                    {slides.length > 1 && (
                      <a
                        href={`/api/messaging/slides/zip?sessionId=${s.id}`}
                        className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
                      >
                        <Download size={14} />
                        All slides (.zip)
                      </a>
                    )}
                    {slides.length === 1 && (
                      <a
                        href={`/api/messaging/deliverables/${slides[0]}`}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
                      >
                        <Download size={14} />
                        Download image
                      </a>
                    )}
                    <a
                      href={`/api/messaging/deliverables/${s.deliverable!.fileName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
                    >
                      <Download size={14} />
                      View PDF
                    </a>
                    <button
                      onClick={() => setDeletingId(s.id)}
                      aria-label="Delete piece"
                      className="chip-accent ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>

                  {renderable && attachedImage && (
                    <div className="mt-3 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/messaging/slides/image?sessionId=${s.id}${
                          imageBust ? `&t=${imageBust}` : ""
                        }`}
                        alt="Slide background"
                        className="h-16 w-16 shrink-0 rounded-sm border border-line-strong object-cover"
                      />
                      <div className="text-[12px] text-paper-faint">
                        Used as the slide background — regenerate to apply.
                        <button
                          onClick={() => removeImage(s.id)}
                          className="ml-2 text-gold hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {slides.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {slides.map((f, i) => {
                        const src = `/api/messaging/deliverables/${f}${bust ? `?t=${bust}` : ""}`;
                        return (
                          <a
                            key={f}
                            href={`/api/messaging/deliverables/${f}`}
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="shrink-0"
                            title={`Slide ${i + 1} — open / download`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={`Slide ${i + 1}`}
                              className="h-44 w-auto border border-line-strong"
                            />
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4">
          <div className="hud-panel stack w-full max-w-sm border-l-[3px] border-gold p-5">
            <h3 className="font-display text-base font-bold uppercase tracking-wide text-paper">
              Delete all pieces?
            </h3>
            <p className="mt-2 text-sm text-paper-dim">
              This permanently deletes all {deliverables.length} finished piece
              {deliverables.length === 1 ? "" : "s"}{" "}
              — conversations, PDFs, slides and uploaded images. Anything still
              in progress is kept. This can&apos;t be undone.
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
