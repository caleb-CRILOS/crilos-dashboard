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
} from "lucide-react";
import { MessagingSession } from "@/lib/types";
import ChatMessages from "@/components/ChatMessages";
import ChatInputRow from "@/components/ChatInputRow";
import { useAgentChat } from "@/hooks/useAgentChat";

export default function MessagingCreatorPage() {
  const { session, allSessions, input, setInput, loading, error, send, startFresh } =
    useAgentChat<MessagingSession>({
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

  const started = session !== null || loading;
  const messages = session?.messages ?? [];

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
        <h2 className="font-display mb-3 text-lg font-bold uppercase tracking-wide text-paper">
          Deliverables
        </h2>
        <p className="mb-3 text-sm text-paper-dim">
          Finished pieces from every Messaging Creator session, newest last.
        </p>
        {slidesError && (
          <div className="mb-3 flex items-center gap-2 border-l-[3px] border-gold bg-ink-raised px-4 py-2 text-sm text-gold">
            <AlertCircle size={15} />
            {slidesError}
          </div>
        )}
        {allSessions.every((s) => !s.deliverable) ? (
          <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
            No pieces drafted yet. They&apos;ll show up here once a
            conversation wraps up.
          </div>
        ) : (
          <div className="hud-panel stack space-y-2 p-3">
            {allSessions
              .filter((s) => s.deliverable)
              .map((s) => {
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
    </div>
  );
}
