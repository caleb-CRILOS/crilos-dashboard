"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Inbox, Mail, MailOpen, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { EmailDraftSession } from "@/lib/types";
import ComposeEmailPanel from "@/components/inbox/ComposeEmailPanel";

interface UnreadThread {
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  clientId?: string;
  clientLabel?: string;
}

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export default function InboxPage() {
  const [threads, setThreads] = useState<UnreadThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Record<string, EmailDraftSession>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [watcherStatus, setWatcherStatus] = useState<{ enabled: boolean; lastCheckedAt: string | null } | null>(
    null,
  );

  async function loadThreads() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email/threads");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load unread mail.");
        return;
      }
      setThreads(data.threads ?? []);
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadThreads();
    fetch("/api/email/watcher-status")
      .then((res) => res.json())
      // eslint-disable-next-line react-hooks/set-state-in-effect
      .then(setWatcherStatus)
      .catch(() => {});
  }, []);

  async function processThread(threadId: string) {
    setProcessingId(threadId);
    setError(null);
    try {
      const res = await fetch(`/api/email/threads/${threadId}/process`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to summarize/draft this thread.");
        return;
      }
      setSessions((prev) => ({ ...prev, [threadId]: data.session }));
      setEdits((prev) => ({ ...prev, [threadId]: data.session.draftText }));
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setProcessingId(null);
    }
  }

  async function saveDraft(threadId: string) {
    setSavingId(threadId);
    setError(null);
    try {
      const res = await fetch(`/api/email/threads/${threadId}/create-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftText: edits[threadId] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save the Gmail draft.");
        return;
      }
      setSessions((prev) => ({ ...prev, [threadId]: data.session }));
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteThread(threadId: string) {
    setDeletingId(threadId);
    setError(null);
    try {
      const res = await fetch(`/api/email/threads/${threadId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete this email.");
        return;
      }
      setThreads((prev) => prev.filter((t) => t.threadId !== threadId));
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setDeletingId(null);
    }
  }

  async function markRead(threadId: string) {
    setMarkingReadId(threadId);
    setError(null);
    try {
      const res = await fetch(`/api/email/threads/${threadId}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to mark this email read.");
        return;
      }
      setThreads((prev) => prev.filter((t) => t.threadId !== threadId));
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setMarkingReadId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="label-mono mb-2 flex items-center gap-2 text-[13px] text-electric">
        <Inbox size={14} />
        Operate / Inbox
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="bleed-type text-paper">
                Inbox
              </h1>
              <p className="mt-1 text-sm text-paper-dim">
                Unread mail, summarized — CRILOS drafts a reply in the
                matched client&apos;s voice and reviews it. Nothing sends;
                review and save as a Gmail draft yourself.
              </p>
              {watcherStatus?.enabled && (
                <p className="label-mono mt-1 text-[13px] text-paper-faint">
                  Auto-checks every 90 min
                  {watcherStatus.lastCheckedAt && ` · last checked ${timeAgo(watcherStatus.lastCheckedAt)}`}
                </p>
              )}
            </div>
            <button
              onClick={loadThreads}
              disabled={loading}
              className="label-mono flex shrink-0 items-center gap-1.5 rounded-sm border border-line-strong px-3 py-1.5 text-[13px] text-paper-dim hover:border-electric hover:text-paper disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 border-l-[3px] border-gold bg-ink-raised px-4 py-3 text-sm text-gold">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>
                {error}
                {error.includes("Settings") && (
                  <>
                    {" "}
                    <a href="/settings" className="underline">
                      Go to Settings
                    </a>
                  </>
                )}
              </span>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {!loading && threads.length === 0 && !error && (
              <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
                No unread mail. Nice.
              </div>
            )}

            {threads.map((t) => {
          const session = sessions[t.threadId];
          const isProcessing = processingId === t.threadId;
          const isSaving = savingId === t.threadId;
          const isDeleting = deletingId === t.threadId;
          const isMarkingRead = markingReadId === t.threadId;
          const rowBusy = isProcessing || isSaving || isDeleting || isMarkingRead;
          return (
            <div key={t.threadId} className="hud-panel stack p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Mail size={15} className="shrink-0 text-electric" />
                    <span className="truncate text-sm font-medium text-paper">{t.subject}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-paper-dim">
                    {t.from}
                    {t.clientLabel && (
                      <span className="label-mono ml-2 rounded-sm border border-line-strong px-2 py-0.5 text-[13px] text-paper-dim">
                        {t.clientLabel}
                      </span>
                    )}
                  </div>
                  {!session && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-paper-faint">{t.snippet}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!session && (
                    <button
                      onClick={() => processThread(t.threadId)}
                      disabled={rowBusy}
                      className="label-mono flex items-center gap-1.5 btn-accent px-3 py-1.5 text-[13px] disabled:opacity-50"
                    >
                      <Sparkles size={14} />
                      {isProcessing ? "Working…" : "Summarize & draft"}
                    </button>
                  )}
                  <button
                    onClick={() => markRead(t.threadId)}
                    disabled={rowBusy}
                    title="Mark as read"
                    className="flex items-center gap-1.5 rounded-sm border border-line-strong px-2.5 py-1.5 text-xs text-paper-dim hover:border-electric hover:text-paper disabled:opacity-50"
                  >
                    <MailOpen size={14} />
                    {isMarkingRead ? "…" : ""}
                  </button>
                  <button
                    onClick={() => deleteThread(t.threadId)}
                    disabled={rowBusy}
                    title="Delete"
                    className="flex items-center gap-1.5 rounded-sm border border-line-strong px-2.5 py-1.5 text-xs text-paper-dim hover:border-clay hover:text-signal-ink disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {isDeleting ? "…" : ""}
                  </button>
                </div>
              </div>

              {session && (
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                  <div>
                    <div className="label-mono mb-1 text-[13px] text-paper-faint">Summary</div>
                    <p className="text-sm text-paper-dim">{session.summary}</p>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="label-mono text-[13px] text-paper-faint">Draft reply</span>
                      {session.status === "saved" && (
                        <span className="label-mono flex items-center gap-1 text-[13px] text-sage">
                          <CheckCircle2 size={13} />
                          Saved to Gmail Drafts
                        </span>
                      )}
                    </div>
                    <textarea
                      value={edits[t.threadId] ?? session.draftText}
                      onChange={(e) =>
                        setEdits((prev) => ({ ...prev, [t.threadId]: e.target.value }))
                      }
                      rows={8}
                      className="w-full field"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => processThread(t.threadId)}
                      disabled={isProcessing}
                      className="label-mono rounded-sm border border-line-strong px-3 py-1.5 text-[13px] text-paper-dim hover:border-electric hover:text-paper disabled:opacity-50"
                    >
                      {isProcessing ? "Regenerating…" : "Regenerate"}
                    </button>
                    <button
                      onClick={() => saveDraft(t.threadId)}
                      disabled={isSaving}
                      className="label-mono btn-accent px-3 py-1.5 text-[13px] disabled:opacity-50"
                    >
                      {isSaving ? "Saving…" : "Save as Gmail draft"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <ComposeEmailPanel />
        </div>
      </div>
    </div>
  );
}
