"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, Download, FileText, Megaphone, Play, Plus } from "lucide-react";
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

  const started = session !== null || loading;
  const messages = session?.messages ?? [];

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
        {allSessions.every((s) => !s.deliverable) ? (
          <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
            No pieces drafted yet. They&apos;ll show up here once a
            conversation wraps up.
          </div>
        ) : (
          <div className="hud-panel stack space-y-2 p-3">
            {allSessions
              .filter((s) => s.deliverable)
              .map((s) => (
                <div
                  key={s.deliverable!.fileName}
                  className="flex items-center justify-between rounded-sm border border-line-strong bg-ink px-4 py-3 text-sm hover:border-electric"
                >
                  <span className="flex items-center gap-2 text-paper-dim">
                    <FileText size={16} className="text-electric" />
                    {s.deliverable!.title}
                    <span className="text-paper-faint">
                      — {s.clientLabel} · {s.piece.format || "?"} / {s.piece.platform || "?"}
                    </span>
                  </span>
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
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
