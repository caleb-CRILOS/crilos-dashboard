"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, ClipboardList, Copy, Play, Plus, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SkoolPostSession } from "@/lib/types";
import { copyText } from "@/lib/clipboard";
import ChatMessages from "@/components/ChatMessages";
import ChatInputRow from "@/components/ChatInputRow";
import { useAgentChat } from "@/hooks/useAgentChat";

function since(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

// Kept in sync with the mode names in src/lib/skoolPost/prompts.ts (FORMAT_LIST
// and the "Gathering the brief" list) -- Quill parses "Selected format: <label>"
// verbatim from the kickoff message built below.
const FORMATS = [
  { value: "Celebration", label: "Celebration — shout out a member's win" },
  { value: "Monday goal post", label: "Monday goal post — this week's focus" },
  { value: "Vulnerable/struggling post", label: "Vulnerable/struggling post" },
  { value: "3-version launch", label: "3-version launch — short/medium/long" },
  { value: "Hot-take", label: "Hot-take — backed by one real number" },
  { value: "Poll", label: "Poll — one question, 4 options" },
  { value: "Rewrite my draft", label: "Rewrite my draft" },
  { value: "Hook + promise", label: "Hook + promise — no body" },
  { value: "Long-form story", label: "Long-form story" },
  { value: "Reply to a frustrated member", label: "Reply to a frustrated member" },
  { value: "Other", label: "Other — something else entirely" },
];

export default function SkoolPostPage() {
  const { session, allSessions, setAllSessions, input, setInput, loading, error, setError, send, startFresh } =
    useAgentChat<SkoolPostSession>({
      endpoint: "/api/skool-post/message",
      autoResume: true,
    });
  const [format, setFormat] = useState(FORMATS[0].value);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const started = session !== null || loading;
  const messages = session?.messages ?? [];
  const completed = [...allSessions]
    .filter((s) => s.complete)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const history = completed.slice(0, 12);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, loading]);

  async function confirmDelete(id: string) {
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/skool-post/message?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete this post.");
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
      const res = await fetch("/api/skool-post/message?all=true", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not delete posts.");
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

  async function copyToClipboard(text: string, key: string) {
    try {
      await copyText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      setError("Couldn't copy to clipboard.");
    }
  }

  function handleStart() {
    send({ message: `Selected format: ${format}` });
  }

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    send({ message: text });
  }

  function handleNewPost() {
    startFresh();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="max-w-2xl">
        <div className="label-mono mb-2 flex items-center gap-2 text-[12px] text-electric">
          <ClipboardList size={14} />
          Build / Efficiency Engine / Skool Posts
        </div>
        <h1 className="bleed-type text-paper">
          Skool Posts
        </h1>
        <p className="mt-1 text-sm text-paper-dim">
          Need something to post in your Skool community? Tell Quill what&apos;s
          going on — a win to celebrate, a goal for the week, a poll, a hot
          take, whatever — and it&apos;ll draft it, Echo checks it sounds like
          you, and you get a finished post ready to paste in.
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-2 border-l-[3px] border-gold bg-ink-raised px-4 py-3 text-sm text-gold">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div>
          {!started ? (
            <div className="hud-panel hud-panel-magenta stack flex h-[640px] flex-col items-center justify-center p-8 text-center">
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-paper">
                Start a new Skool post
              </h2>

              <div className="mt-4 w-full max-w-xs text-left">
                <label className="label-mono mb-1 block text-[11px] text-paper-faint">
                  Post format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full field"
                >
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleStart}
                className="label-mono mt-6 flex items-center gap-2 btn-accent px-4 py-2 text-[12px]"
              >
                <Play size={15} />
                Start Skool Posts
              </button>
            </div>
          ) : (
            <div className="hud-panel hud-panel-magenta stack flex h-[640px] flex-col">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <div className="label-mono text-[12px] text-paper-dim">{session?.clientLabel}</div>
                <button
                  onClick={handleNewPost}
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
        </div>

        <div>
          {session?.complete && (
            <div className="hud-panel stack border-l-[3px] border-sage p-4 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="label-mono text-xs text-sage">
                  Post complete — {session.post.mode || "your draft"}
                </span>
                <span className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(session.post.finalText ?? "", "current")}
                    className="label-mono flex items-center gap-1 rounded-sm border border-sage px-3 py-1 text-[11px] text-sage hover:bg-sage/10"
                  >
                    {copiedKey === "current" ? <Check size={13} /> : <Copy size={13} />}
                    {copiedKey === "current" ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={handleNewPost}
                    className="label-mono rounded-sm border border-sage px-3 py-1 text-[11px] text-sage hover:bg-sage/10"
                  >
                    Draft another
                  </button>
                </span>
              </div>
              <pre className="whitespace-pre-wrap rounded-sm border border-line-strong bg-ink p-3 text-sm text-paper-dim">
                {session.post.finalText}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display mb-3 text-lg font-bold uppercase tracking-wide text-paper">
          Recent posts
        </h2>
        {history.length === 0 ? (
          <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
            No completed posts yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((s) =>
              deletingId === s.id ? (
                <div
                  key={s.id}
                  className="hud-panel stack flex flex-col justify-between border-l-[3px] border-gold p-4"
                >
                  <p className="text-sm text-paper-dim">Delete this post? This can&apos;t be undone.</p>
                  <div className="mt-3 flex items-center gap-2">
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
                <div key={s.id} className="hud-panel stack p-4">
                  <div className="flex items-center justify-between">
                    <span className="label-mono text-[11px] text-paper-faint">
                      {s.post.mode || "Post"}
                    </span>
                    <span className="flex items-center gap-2 text-paper-faint">
                      <button
                        onClick={() => copyToClipboard(s.post.finalText ?? "", s.id)}
                        aria-label="Copy post"
                        className="hover:text-paper"
                      >
                        {copiedKey === s.id ? <Check size={14} className="text-sage" /> : <Copy size={14} />}
                      </button>
                      <button
                        onClick={() => setDeletingId(s.id)}
                        aria-label="Delete post"
                        className="hover:text-gold"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-paper-dim">{truncate(s.post.finalText ?? "", 140)}</p>
                  <div className="mt-2 text-xs text-paper-faint">{since(s.updatedAt)}</div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-paper">
            Post history
          </h2>
          <div className="flex items-center gap-2">
            {completed.length > 0 && (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="label-mono flex items-center gap-1.5 rounded-sm border border-line-strong px-3 py-1.5 text-[11px] text-paper-dim hover:border-gold hover:text-gold"
              >
                <Trash2 size={14} />
                Delete all posts
              </button>
            )}
            <button
              onClick={() => setShowAll((v) => !v)}
              className="label-mono rounded-sm border border-line-strong px-3 py-1.5 text-[11px] text-paper-dim hover:border-electric hover:text-paper"
            >
              {showAll ? "Hide" : `View all (${completed.length})`}
            </button>
          </div>
        </div>

        {showAll &&
          (completed.length === 0 ? (
            <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
              No completed posts yet.
            </div>
          ) : (
            <div className="hud-panel stack space-y-2 p-3">
              {completed.map((s) =>
                deletingId === s.id ? (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-sm border border-gold/60 bg-ink-raised px-4 py-3 text-sm"
                  >
                    <span className="text-paper-dim">
                      Delete this post ({s.post.mode || "Post"})? This can&apos;t be undone.
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
                    className="flex items-center justify-between gap-3 rounded-sm border border-line-strong bg-ink px-4 py-3 text-sm hover:border-electric"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="label-mono mr-2 text-[11px] text-paper-faint">
                        {s.post.mode || "Post"}
                      </span>
                      <span className="text-paper-dim">{truncate(s.post.finalText ?? "", 100)}</span>
                      <span className="ml-2 text-xs text-paper-faint">— {since(s.updatedAt)}</span>
                    </span>
                    <div className="ml-3 flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(s.post.finalText ?? "", s.id)}
                        aria-label="Copy post"
                        className="chip-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
                      >
                        {copiedKey === s.id ? <Check size={14} /> : <Copy size={14} />}
                        {copiedKey === s.id ? "Copied" : "Copy"}
                      </button>
                      <button
                        onClick={() => setDeletingId(s.id)}
                        aria-label="Delete post"
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
          ))}
      </div>

      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4">
          <div className="hud-panel stack w-full max-w-sm border-l-[3px] border-gold p-5">
            <h3 className="font-display text-base font-bold uppercase tracking-wide text-paper">
              Delete all posts?
            </h3>
            <p className="mt-2 text-sm text-paper-dim">
              This permanently deletes all {completed.length} completed post
              {completed.length === 1 ? "" : "s"}. This can&apos;t be undone.
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
