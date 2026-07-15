"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus, Check, AlertCircle, Play, FileText, Download } from "lucide-react";
import { ChatMessage, OnboardingSession, OnboardingStage } from "@/lib/types";
import ChatMessages from "@/components/ChatMessages";
import ChatInputRow from "@/components/ChatInputRow";

const STAGES: { key: OnboardingStage; label: string }[] = [
  { key: "setup", label: "Setup Interview" },
  { key: "ica", label: "Ideal Client Avatar" },
  { key: "contentBible", label: "Content Bible" },
];

const STAGE_INTROS: Record<
  OnboardingStage,
  { title: string; description: string; button: string }
> = {
  setup: {
    title: "Start the setup interview",
    description:
      "Atlas will walk through the client's identity, business, offer, voice, and goals — about 5 minutes.",
    button: "Start Setup Interview",
  },
  ica: {
    title: "Define the Ideal Client Avatar",
    description:
      "A short interview to build a demographic and behavioral profile of this client's ideal customer.",
    button: "Start ICA Interview",
  },
  contentBible: {
    title: "Map the Content Bible",
    description:
      "The final stage — mapping the full journey from lead to client, goal by goal.",
    button: "Start Content Bible Interview",
  },
};

function messagesFor(session: OnboardingSession | null, stage: OnboardingStage): ChatMessage[] {
  if (!session) return [];
  if (stage === "setup") return session.setupMessages;
  if (stage === "ica") return session.icaMessages;
  return session.contentBibleMessages;
}

function isComplete(session: OnboardingSession | null, stage: OnboardingStage): boolean {
  if (!session) return false;
  if (stage === "setup") return session.setupComplete;
  if (stage === "ica") return session.icaComplete;
  return session.contentBibleComplete;
}

export default function OnboardingPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [stage, setStage] = useState<OnboardingStage>("setup");
  const [startedStages, setStartedStages] = useState<Partial<Record<OnboardingStage, boolean>>>(
    {},
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allSessions, setAllSessions] = useState<OnboardingSession[]>([]);
  const [clientId, setClientId] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = messagesFor(session, stage);
  const hasStarted = !!startedStages[stage];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, loading]);

  useEffect(() => {
    // Prefill from the "Onboard this client" link on a client's detail
    // page (?clientId=...) -- read via window.location instead of
    // useSearchParams to avoid a Suspense boundary requirement for what's
    // a one-time prefill, not reactive routing state.
    const qp = new URLSearchParams(window.location.search).get("clientId");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (qp) setClientId(qp);
  }, []);

  async function refreshAllSessions() {
    try {
      const res = await fetch("/api/onboarding/message");
      const data = await res.json();
      if (res.ok) setAllSessions(data.sessions ?? []);
    } catch {
      // Deliverables list just won't refresh this time -- not worth
      // surfacing an error banner over.
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshAllSessions();
  }, []);

  async function send(message: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId ?? undefined, stage, message, clientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setSessionId(data.sessionId);
      setSession(data.session);
      if (data.session?.deliverables && Object.keys(data.session.deliverables).length > 0) {
        refreshAllSessions();
      }
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  function handleStart() {
    setStartedStages((s) => ({ ...s, [stage]: true }));
    send("");
  }

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    send(text);
  }

  function goToStage(next: OnboardingStage) {
    setStage(next);
  }

  const currentIndex = STAGES.findIndex((s) => s.key === stage);
  const nextStage = STAGES[currentIndex + 1];
  const intro = STAGE_INTROS[stage];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="label-mono mb-2 flex items-center gap-2 text-[12px] text-electric">
        <UserPlus size={14} />
        Operate / Onboarding
      </div>
      <h1 className="bleed-type text-paper">
        Onboarding
      </h1>
      <p className="mt-1 text-sm text-paper-dim">
        A conversation with Atlas — the same setup interview, ICA, and
        Content Bible process as the CRILOS CLI product, run one stage at
        a time.
      </p>

      <div className="mt-6 flex items-center gap-2">
        {STAGES.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div
              className={`label-mono flex h-6 w-6 shrink-0 items-center justify-center text-[12px] ${
                isComplete(session, s.key)
                  ? "bg-clay text-signal-fg"
                  : i === currentIndex
                    ? "border border-clay text-signal-ink"
                    : "border border-line-strong text-paper-faint"
              }`}
            >
              {isComplete(session, s.key) ? <Check size={13} /> : i + 1}
            </div>
            <span
              className={`label-mono hidden text-[11px] md:inline ${i === currentIndex ? "text-paper" : "text-paper-faint"}`}
            >
              {s.label}
            </span>
            {i < STAGES.length - 1 && (
              <div
                className={`h-px flex-1 ${isComplete(session, s.key) ? "bg-clay/50" : "bg-line"}`}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 border-l-[3px] border-gold bg-ink-raised px-4 py-3 text-sm text-gold">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!hasStarted ? (
        <div className="hud-panel hud-panel-magenta stack mt-6 flex h-[520px] flex-col items-center justify-center p-8 text-center">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-paper">
            {intro.title}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-paper-dim">{intro.description}</p>

          <button
            onClick={handleStart}
            className="label-mono mt-6 flex items-center gap-2 btn-accent px-4 py-2 text-[12px]"
          >
            <Play size={15} />
            {intro.button}
          </button>
        </div>
      ) : (
        <div className="hud-panel hud-panel-magenta stack mt-6 flex h-[520px] flex-col">
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

      {isComplete(session, stage) && nextStage && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => goToStage(nextStage.key)}
            className="label-mono btn-accent px-4 py-1.5 text-[12px]"
          >
            Continue to {nextStage.label} →
          </button>
        </div>
      )}

      {isComplete(session, "contentBible") && (
        <div className="mt-4 border-l-[3px] border-sage bg-ink-raised px-4 py-3 text-sm text-sage">
          Onboarding complete — {session?.profile.businessName || session?.profile.name || "this client"}&apos;s
          profile, voice, ICA, and content bible are all captured.
        </div>
      )}

      <div className="mt-10">
        <h2 className="font-display mb-3 text-lg font-bold uppercase tracking-wide text-paper">
          Repository
        </h2>
        <p className="mb-3 text-sm text-paper-dim">
          PDFs generated as each stage completes, across every onboarding
          session — the client can review these on their own time.
        </p>
        {allSessions.every((s) => Object.keys(s.deliverables).length === 0) ? (
          <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
            No deliverables generated yet. They&apos;ll show up here as each
            onboarding stage completes.
          </div>
        ) : (
          <div className="hud-panel stack space-y-2 p-3">
            {allSessions.flatMap((s) =>
              STAGES.filter((stg) => s.deliverables[stg.key]).map((stg) => {
                const deliverable = s.deliverables[stg.key]!;
                const clientLabel = s.profile.businessName || s.profile.name || s.id;
                return (
                  <a
                    key={deliverable.fileName}
                    href={`/api/onboarding/deliverables/${deliverable.fileName}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-sm border border-line-strong bg-ink px-4 py-3 text-sm hover:border-electric"
                  >
                    <span className="flex items-center gap-2 text-paper-dim">
                      <FileText size={16} className="text-electric" />
                      {deliverable.title}
                      <span className="text-paper-faint">— {clientLabel}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-paper-faint">
                      <Download size={14} />
                      View PDF
                    </span>
                  </a>
                );
              }),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
