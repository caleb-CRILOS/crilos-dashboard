"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Mail, Plus } from "lucide-react";
import { ComposeEmailSession } from "@/lib/types";
import ChatMessages from "@/components/ChatMessages";
import ChatInputRow from "@/components/ChatInputRow";

export default function ComposeEmailPanel() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<ComposeEmailSession | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toEdit, setToEdit] = useState("");
  const [subjectEdit, setSubjectEdit] = useState("");
  const [bodyEdit, setBodyEdit] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = session?.messages ?? [];
  const hasDraft = !!(session && (session.subject || session.bodyText || session.to));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, loading]);

  async function send(message: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email/compose/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId ?? undefined, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setSessionId(data.sessionId);
      setSession(data.session);
      setToEdit(data.session.to);
      setSubjectEdit(data.session.subject);
      setBodyEdit(data.session.bodyText);
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    send(text);
  }

  async function saveDraft() {
    if (!sessionId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/email/compose/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, to: toEdit, subject: subjectEdit, bodyText: bodyEdit }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save the Gmail draft.");
        return;
      }
      setSession(data.session);
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setSaving(false);
    }
  }

  function handleNewDraft() {
    setSessionId(null);
    setSession(null);
    setInput("");
    setError(null);
    setToEdit("");
    setSubjectEdit("");
    setBodyEdit("");
  }

  return (
    <div className="hud-panel stack flex h-[600px] flex-col">
      <div className="flex items-center justify-between border-b border-line-strong px-4 py-3">
        <div className="label-mono flex items-center gap-2 text-[13px] text-electric">
          <Mail size={14} />
          New email
        </div>
        {session && (
          <button
            onClick={handleNewDraft}
            className="label-mono flex items-center gap-1 text-[13px] text-paper-faint hover:text-paper"
          >
            <Plus size={13} />
            New draft
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 border-b border-line-strong bg-ink-raised px-4 py-2.5 text-xs text-gold">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!session ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <Mail size={20} className="text-paper-faint" />
          <p className="text-sm text-paper-dim">
            Tell CRILOS who you&apos;re emailing and what it&apos;s about — it&apos;ll
            draft it, review it, and you&apos;ll get a chance to
            edit before it&apos;s saved.
          </p>
        </div>
      ) : (
        <ChatMessages
          messages={messages}
          loading={loading}
          loadingLabel="Thinking…"
          personaName="CRILOS"
          scrollRef={scrollRef}
        />
      )}

      {hasDraft && (
        <div className="space-y-2 border-t border-line-strong p-4">
          <div className="flex items-center justify-between">
            <span className="label-mono text-[13px] text-paper-faint">Draft</span>
            {session!.status === "saved" && (
              <span className="label-mono flex items-center gap-1 text-[13px] text-sage">
                <CheckCircle2 size={13} />
                Saved to Gmail Drafts
              </span>
            )}
          </div>
          <input
            value={toEdit}
            onChange={(e) => setToEdit(e.target.value)}
            placeholder="To"
            className="w-full field text-sm"
          />
          <input
            value={subjectEdit}
            onChange={(e) => setSubjectEdit(e.target.value)}
            placeholder="Subject"
            className="w-full field text-sm"
          />
          <textarea
            value={bodyEdit}
            onChange={(e) => setBodyEdit(e.target.value)}
            rows={8}
            className="w-full field text-sm"
          />
          <div className="flex items-center justify-end">
            <button
              onClick={saveDraft}
              disabled={saving}
              className="label-mono btn-accent px-3 py-1.5 text-[13px] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save as Gmail draft"}
            </button>
          </div>
        </div>
      )}

      <ChatInputRow
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={loading}
        placeholder={session ? "Type your reply..." : "Who do you want to email, and what's it about?"}
      />
    </div>
  );
}
