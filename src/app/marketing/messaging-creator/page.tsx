"use client";

import { useEffect, useRef, useState } from "react";
import { format as formatDate, isBefore, parseISO, startOfDay } from "date-fns";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Megaphone,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { MessagingSession } from "@/lib/types";
import { copyText } from "@/lib/clipboard";
import ChatMessages from "@/components/ChatMessages";
import ChatInputRow from "@/components/ChatInputRow";
import { useAgentChat } from "@/hooks/useAgentChat";

// The caption a user actually pastes into the platform: the drafted caption
// (falling back to the full piece, which IS the caption on a single-image
// post) with the hashtags appended.
function captionForCopy(s: MessagingSession): string {
  const body = (s.piece.caption || s.piece.finalText || "").trim();
  const tags = (s.piece.hashtags ?? []).map((t) => `#${t.replace(/^#/, "")}`).join(" ");
  return tags ? `${body}\n\n${tags}` : body;
}

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
  // Which card is busy attaching a background, and how -- the mode drives the
  // button label ("Uploading…" vs "Generating…") without a second flag.
  const [bgBusy, setBgBusy] = useState<{ id: string; mode: "ai" | "upload" } | null>(null);
  // Art-direction prompt typed into a card; overrides piece.imageConcept.
  const [aiPromptBySession, setAiPromptBySession] = useState<Record<string, string>>({});

  // Copy-to-clipboard feedback, keyed per button so only the one clicked
  // flips to a checkmark, and which card has its alternate hooks expanded.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openHooksId, setOpenHooksId] = useState<string | null>(null);

  // Posting schedule: which card has its date picker open, and which is
  // mid-request. The date itself lives on the session, not in local state.
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleBusyId, setScheduleBusyId] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);

  const started = session !== null || loading;
  const messages = session?.messages ?? [];
  const deliverables = allSessions.filter((s) => s.deliverable);
  // Soonest first, so the schedule panel reads as a plan rather than a list.
  const scheduled = allSessions
    .filter((s) => s.scheduledFor)
    .sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!));
  const today = startOfDay(new Date());

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

  // Attach a slide background, either from a picked file or generated from the
  // piece's image concept. Both land on the same session field, so they share
  // one request path and one busy flag.
  async function attachBackground(
    sessionId: string,
    opts: { mode: "ai" | "upload"; file?: File; prompt?: string },
  ) {
    setBgBusy({ id: sessionId, mode: opts.mode });
    setSlidesError(null);
    try {
      const form = new FormData();
      form.set("sessionId", sessionId);
      form.set("mode", opts.mode);
      if (opts.file) form.set("file", opts.file);
      if (opts.prompt) form.set("prompt", opts.prompt);
      const res = await fetch("/api/messaging/slides/image", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not attach that background");
      setImageBySession((m) => ({ ...m, [sessionId]: data.slideImageFile }));
      setImageBustBySession((m) => ({ ...m, [sessionId]: Date.now() }));
      setAllSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, slideImageKind: data.slideImageKind } : s)),
      );
    } catch (e) {
      setSlidesError(e instanceof Error ? e.message : "Could not attach that background");
    } finally {
      setBgBusy(null);
    }
  }

  async function copyToClipboard(text: string, key: string) {
    if (!text.trim()) {
      setSlidesError("There's nothing to copy on this piece.");
      return;
    }
    try {
      await copyText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      setSlidesError("Couldn't copy to clipboard.");
    }
  }

  // Set or clear the planned posting day. Persisted server-side, then mirrored
  // into allSessions so the schedule panel updates without a refetch.
  async function setSchedule(sessionId: string, scheduledFor: string | null) {
    setScheduleBusyId(sessionId);
    setSlidesError(null);
    try {
      const res = scheduledFor
        ? await fetch("/api/messaging/schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, scheduledFor }),
          })
        : await fetch(`/api/messaging/schedule?sessionId=${encodeURIComponent(sessionId)}`, {
            method: "DELETE",
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update the schedule");
      setAllSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, scheduledFor: scheduledFor ?? undefined } : s,
        ),
      );
      setSchedulingId(null);
    } catch (e) {
      setSlidesError(e instanceof Error ? e.message : "Could not update the schedule");
    } finally {
      setScheduleBusyId(null);
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
      setAllSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, slideImageKind: undefined } : s)),
      );
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
      <div className="label-mono mb-2 flex items-center gap-2 text-[13px] text-electric">
        <Megaphone size={14} />
        Build / Influence Building / Messaging Creator
      </div>
      <h1 className="bleed-type text-paper">
        Messaging Creator
      </h1>
      <p className="mt-1 text-sm text-paper-dim">
        A conversation that greets you, proposes four content ideas from
        your content guide, then drafts whichever one you pick — IG image
        script, carousel script, video script, or blog post — in your own
        voice. Every finished piece comes with a paste-ready caption,
        hashtags, alternate hooks to test, an image concept you can render
        into on-brand slides, and a day to post it.
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
            Start a new piece of content
          </h2>
          <p className="mt-2 max-w-sm text-sm text-paper-dim">
            Get a greeting, four ready-made ideas, and a finished draft —
            same process as the CRILOS CLI&apos;s messaging-creator skill.
          </p>

          <button
            onClick={handleStart}
            className="label-mono mt-6 flex items-center gap-2 btn-accent px-4 py-2 text-[13px]"
          >
            <Play size={15} />
            Start Messaging Creator
          </button>
        </div>
      ) : (
        <div className="hud-panel hud-panel-magenta stack mt-6 flex h-[520px] flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="label-mono text-[13px] text-paper-dim">{session?.clientLabel}</div>
            <button
              onClick={handleNewPiece}
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
          <span>
            Piece complete — {session.piece.topic || "your draft"} is ready in
            Deliverables below.
          </span>
          <button
            onClick={handleNewPiece}
            className="label-mono rounded-sm border border-sage px-3 py-1 text-[13px] hover:bg-sage/10"
          >
            Draft another
          </button>
        </div>
      )}

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold text-paper">
          Posting schedule
        </h2>
        <p className="mb-3 mt-1 text-sm text-paper-dim">
          Pieces you&apos;ve given a date, soonest first. Set one with Schedule on any
          deliverable below.
        </p>
        {scheduled.length === 0 ? (
          <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
            Nothing scheduled yet.
          </div>
        ) : (
          <div className="hud-panel stack space-y-1 p-3">
            {scheduled.map((s) => {
              const day = parseISO(s.scheduledFor!);
              const overdue = isBefore(day, today);
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm border border-line-strong bg-ink px-4 py-2.5 text-sm"
                >
                  <span className="label-mono w-24 shrink-0 text-[13px] text-electric">
                    {formatDate(day, "EEE MMM d")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-paper-dim">
                    {s.piece.topic || s.deliverable?.title || "Untitled piece"}
                  </span>
                  <span className="shrink-0 text-[13px] text-paper-faint">
                    {s.piece.format || "?"} / {s.piece.platform || "?"}
                  </span>
                  {overdue && (
                    <span className="label-mono shrink-0 text-[13px] text-gold">Overdue</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-paper">
            Deliverables
          </h2>
          {deliverables.length > 0 && (
            <button
              onClick={() => setConfirmDeleteAll(true)}
              className="label-mono flex items-center gap-1.5 rounded-sm border border-line-strong px-3 py-1.5 text-[13px] text-paper-dim hover:border-gold hover:text-gold"
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
              const busyOnCard = bgBusy?.id === s.id;
              const hooks = s.piece.hookVariants ?? [];

              if (deletingId === s.id) {
                return (
                  <div
                    key={s.deliverable!.fileName}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-gold/60 bg-ink-raised px-4 py-3 text-sm"
                  >
                    <span className="text-paper-dim">
                      Delete &ldquo;{s.deliverable!.title}&rdquo;? The conversation, its
                      PDF{slides.length > 0 ? ", slides" : ""}{" "}
                      and any background image go too. This can&apos;t be undone.
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => confirmDelete(s.id)}
                        disabled={deleteBusy}
                        className="label-mono rounded-sm border border-gold px-3 py-1 text-[13px] text-gold hover:bg-gold/10 disabled:opacity-50"
                      >
                        {deleteBusy ? "Deleting…" : "Delete"}
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
                    <div className="mt-0.5 truncate text-[13px] text-paper-faint">
                      {s.clientLabel} · {s.piece.format || "?"} / {s.piece.platform || "?"}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {renderable && (
                      <button
                        onClick={() => generateSlides(s.id)}
                        disabled={generatingId === s.id}
                        className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[13px] disabled:opacity-50"
                      >
                        <ImageIcon size={14} />
                        {generatingId === s.id
                          ? "Rendering…"
                          : `${slides.length ? "Regenerate" : "Generate"} ${noun}`}
                      </button>
                    )}
                    {renderable && (
                      <label
                        className={`chip-accent flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[13px] ${
                          busyOnCard ? "opacity-50" : ""
                        }`}
                      >
                        <ImageIcon size={14} />
                        {bgBusy?.id === s.id && bgBusy.mode === "upload"
                          ? "Uploading…"
                          : attachedImage
                            ? "Change image"
                            : "Add image"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          disabled={busyOnCard}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) attachBackground(s.id, { mode: "upload", file: f });
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                    {slides.length > 1 && (
                      <a
                        href={`/api/messaging/slides/zip?sessionId=${s.id}`}
                        className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
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
                        className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
                      >
                        <Download size={14} />
                        Download image
                      </a>
                    )}
                    <button
                      onClick={() => copyToClipboard(captionForCopy(s), `caption-${s.id}`)}
                      className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
                    >
                      {copiedKey === `caption-${s.id}` ? (
                        <Check size={14} className="text-sage" />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copiedKey === `caption-${s.id}` ? "Copied" : "Copy caption"}
                    </button>
                    {hooks.length > 0 && (
                      <button
                        onClick={() => setOpenHooksId((id) => (id === s.id ? null : s.id))}
                        aria-expanded={openHooksId === s.id}
                        className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
                      >
                        <ChevronDown
                          size={14}
                          className={`transition-transform ${openHooksId === s.id ? "" : "-rotate-90"}`}
                        />
                        {hooks.length} hooks
                      </button>
                    )}
                    <button
                      onClick={() => setSchedulingId((id) => (id === s.id ? null : s.id))}
                      className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
                    >
                      <CalendarDays size={14} />
                      {s.scheduledFor
                        ? formatDate(parseISO(s.scheduledFor), "MMM d")
                        : "Schedule"}
                    </button>
                    <a
                      href={`/api/messaging/deliverables/${s.deliverable!.fileName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
                    >
                      <Download size={14} />
                      View PDF
                    </a>
                    <button
                      onClick={() => setDeletingId(s.id)}
                      aria-label="Delete piece"
                      className="chip-accent ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>

                  {openHooksId === s.id && hooks.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-l-[3px] border-line-strong pl-3">
                      <div className="label-mono text-[13px] text-paper-faint">
                        Swap in for the caption&apos;s first line
                      </div>
                      {hooks.map((hook, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="flex-1 text-sm text-paper-dim">{hook}</span>
                          <button
                            onClick={() => copyToClipboard(hook, `hook-${s.id}-${i}`)}
                            aria-label={`Copy hook ${i + 1}`}
                            className="shrink-0 text-paper-faint hover:text-paper"
                          >
                            {copiedKey === `hook-${s.id}-${i}` ? (
                              <Check size={14} className="text-sage" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {schedulingId === s.id && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-l-[3px] border-electric bg-ink-raised px-3 py-2">
                      <input
                        type="date"
                        defaultValue={s.scheduledFor ?? ""}
                        disabled={scheduleBusyId === s.id}
                        onChange={(e) => {
                          if (e.target.value) setSchedule(s.id, e.target.value);
                        }}
                        className="rounded-sm border border-line-strong bg-ink px-2 py-1 font-mono text-[13px] text-paper disabled:opacity-50"
                      />
                      {s.piece.suggestedPostAt && !s.scheduledFor && (
                        <span className="text-[13px] text-paper-faint">
                          CRILOS suggested {s.piece.suggestedPostAt}
                        </span>
                      )}
                      {s.scheduledFor && (
                        <button
                          onClick={() => setSchedule(s.id, null)}
                          disabled={scheduleBusyId === s.id}
                          className="label-mono flex items-center gap-1 text-[13px] text-gold hover:underline disabled:opacity-50"
                        >
                          <X size={13} />
                          Unschedule
                        </button>
                      )}
                    </div>
                  )}

                  {renderable && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={aiPromptBySession[s.id] ?? s.piece.imageConcept ?? ""}
                        onChange={(e) =>
                          setAiPromptBySession((m) => ({ ...m, [s.id]: e.target.value }))
                        }
                        placeholder="Describe the background image…"
                        className="min-w-0 flex-1 rounded-sm border border-line-strong bg-ink px-2 py-1.5 text-[13px] text-paper placeholder:text-paper-faint"
                      />
                      <button
                        onClick={() =>
                          attachBackground(s.id, {
                            mode: "ai",
                            prompt: aiPromptBySession[s.id] ?? s.piece.imageConcept,
                          })
                        }
                        disabled={busyOnCard}
                        className="chip-accent flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[13px] disabled:opacity-50"
                      >
                        <Sparkles size={14} />
                        {bgBusy?.id === s.id && bgBusy.mode === "ai"
                          ? "Generating…"
                          : "Generate background"}
                      </button>
                    </div>
                  )}

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
                      <div className="text-[13px] text-paper-faint">
                        {s.slideImageKind === "ai" ? "Generated" : "Uploaded"} background —
                        regenerate to apply.
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
            <h3 className="font-display text-base font-semibold text-paper">
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
                className="label-mono rounded-sm border border-line-strong px-3 py-1.5 text-[13px] text-paper-dim hover:bg-paper/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleteAllBusy}
                className="label-mono rounded-sm border border-gold px-3 py-1.5 text-[13px] text-gold hover:bg-gold/10 disabled:opacity-50"
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
