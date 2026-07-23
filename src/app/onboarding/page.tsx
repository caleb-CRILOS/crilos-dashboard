"use client";

import { useEffect, useRef, useState } from "react";
import {
  UserPlus,
  Check,
  AlertCircle,
  ChevronLeft,
  Play,
  Plus,
  RotateCcw,
  FileText,
  Download,
} from "lucide-react";
import { ChatMessage, OnboardingSession, OnboardingStage } from "@/lib/types";
import ChatMessages from "@/components/ChatMessages";
import ChatInputRow from "@/components/ChatInputRow";

const STAGES: { key: OnboardingStage; label: string }[] = [
  { key: "setup", label: "Setup Interview" },
  { key: "ica", label: "Ideal Client Avatar" },
  { key: "contentGuide", label: "Content Guide" },
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
  contentGuide: {
    title: "Map the Content Guide",
    description:
      "The final stage — mapping the full journey from lead to client, goal by goal.",
    button: "Start Content Guide Interview",
  },
};

function messagesFor(session: OnboardingSession | null, stage: OnboardingStage): ChatMessage[] {
  if (!session) return [];
  if (stage === "setup") return session.setupMessages;
  if (stage === "ica") return session.icaMessages;
  return session.contentGuideMessages;
}

function isComplete(session: OnboardingSession | null, stage: OnboardingStage): boolean {
  if (!session) return false;
  if (stage === "setup") return session.setupComplete;
  if (stage === "ica") return session.icaComplete;
  return session.contentGuideComplete;
}

// Which earlier stage, if any, has been completed more recently than this one
// -- meaning this stage was built on answers that have since changed. ISO
// timestamps compare lexicographically, so a string compare is a date compare.
// Sessions predating stageCompletedAt have no timestamps and report null,
// since their real ordering isn't knowable.
function builtOnOlder(
  session: OnboardingSession | null,
  stage: OnboardingStage,
): OnboardingStage | null {
  const at = session?.stageCompletedAt;
  const mine = at?.[stage];
  if (!at || !mine) return null;
  if (stage === "ica") return at.setup && at.setup > mine ? "setup" : null;
  if (stage === "contentGuide") {
    if (at.setup && at.setup > mine) return "setup";
    if (at.ica && at.ica > mine) return "ica";
  }
  return null;
}

// Open a resumed session on its furthest incomplete stage; if everything is
// done, start at Setup so the redo controls are the first thing in reach.
function initialStageFor(s: OnboardingSession): OnboardingStage {
  if (!s.setupComplete) return "setup";
  if (!s.icaComplete) return "ica";
  if (!s.contentGuideComplete) return "contentGuide";
  return "setup";
}

function sessionLabel(s: OnboardingSession): string {
  return s.profile.businessName || s.profile.name || s.id;
}

const STAGE_LABEL: Record<OnboardingStage, string> = {
  setup: "Setup Interview",
  ica: "Ideal Client Avatar",
  contentGuide: "Content Guide",
};

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
  // Nothing loads until an onboarding is chosen -- picking is explicit so it's
  // never ambiguous which client's profile a redo is about to rewrite.
  const [picked, setPicked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = messagesFor(session, stage);
  // Derived, not just local state: a resumed session already has a transcript,
  // and would otherwise sit behind the "start this stage" intro screen.
  const hasStarted = messages.length > 0 || !!startedStages[stage];
  const staleAgainst = builtOnOlder(session, stage);

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

  async function send(message: string, intent?: "revise") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId ?? undefined,
          stage,
          message,
          clientId,
          intent,
        }),
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

  function openSession(s: OnboardingSession) {
    setSessionId(s.id);
    setSession(s);
    setClientId(s.clientId ?? "");
    setStage(initialStageFor(s));
    setStartedStages({});
    setError(null);
    setPicked(true);
  }

  function startNewOnboarding() {
    setSessionId(null);
    setSession(null);
    setStage("setup");
    setStartedStages({});
    setError(null);
    setPicked(true);
  }

  function backToSessions() {
    setPicked(false);
    setError(null);
    refreshAllSessions();
  }

  // Re-runs a finished stage as a review: Atlas opens with what's on file and
  // asks what changed. The transcript and the captured data both survive.
  function handleRedo() {
    if (loading) return;
    setStartedStages((s) => ({ ...s, [stage]: true }));
    send("", "revise");
  }

  const currentIndex = STAGES.findIndex((s) => s.key === stage);
  const nextStage = STAGES[currentIndex + 1];
  const intro = STAGE_INTROS[stage];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="label-mono mb-2 flex items-center gap-2 text-[13px] text-electric">
        <UserPlus size={14} />
        Operate / Onboarding
      </div>
      <h1 className="bleed-type text-paper">
        Onboarding
      </h1>
      <p className="mt-1 text-sm text-paper-dim">
        A conversation with Atlas — the same setup interview, ICA, and
        Content Guide process as the CRILOS CLI product, run one stage at
        a time. Come back any time to update a stage as the business changes.
      </p>

      {!picked ? (
        <div className="mt-6">
          <h2 className="font-display text-lg font-semibold text-paper">
            Pick an onboarding
          </h2>
          <p className="mb-3 mt-1 text-sm text-paper-dim">
            Open an existing one to continue it or update a stage, or start a
            new one for another client.
          </p>
          <div className="hud-panel stack space-y-2 p-3">
            {allSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => openSession(s)}
                className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-sm border border-line-strong bg-ink px-4 py-3 text-left text-sm hover:border-electric"
              >
                <span className="min-w-0 truncate text-paper-dim">{sessionLabel(s)}</span>
                <span className="label-mono flex shrink-0 items-center gap-2 text-[13px]">
                  {STAGES.map((stg) => (
                    <span
                      key={stg.key}
                      className={isComplete(s, stg.key) ? "text-sage" : "text-paper-faint"}
                    >
                      {stg.label} {isComplete(s, stg.key) ? "✓" : "—"}
                    </span>
                  ))}
                </span>
              </button>
            ))}
            <button
              onClick={startNewOnboarding}
              className="flex w-full items-center gap-2 rounded-sm border border-dashed border-line-strong bg-ink px-4 py-3 text-left text-sm text-paper-dim hover:border-electric hover:text-paper"
            >
              <Plus size={15} />
              Start a new onboarding
            </button>
          </div>
        </div>
      ) : (
        <>
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={backToSessions}
          className="label-mono flex items-center gap-1.5 text-[13px] text-paper-dim hover:text-paper"
        >
          <ChevronLeft size={14} />
          All onboardings
        </button>
        <span className="label-mono truncate text-[13px] text-paper-faint">
          {session ? sessionLabel(session) : "New onboarding"}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {STAGES.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div
              className={`label-mono flex h-6 w-6 shrink-0 items-center justify-center text-[13px] ${
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
              className={`label-mono hidden text-[13px] md:inline ${i === currentIndex ? "text-paper" : "text-paper-faint"}`}
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

      {staleAgainst && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-l-[3px] border-gold bg-ink-raised px-4 py-3 text-sm text-gold">
          <span>
            This was built on older {STAGE_LABEL[staleAgainst]} answers, which have
            changed since. Worth a look — the data below is still intact.
          </span>
        </div>
      )}

      {!hasStarted ? (
        <div className="hud-panel hud-panel-magenta stack mt-6 flex h-[520px] flex-col items-center justify-center p-8 text-center">
          <h2 className="font-display text-lg font-semibold text-paper">
            {intro.title}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-paper-dim">{intro.description}</p>

          <button
            onClick={handleStart}
            className="label-mono mt-6 flex items-center gap-2 btn-accent px-4 py-2 text-[13px]"
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

      {isComplete(session, stage) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleRedo}
            disabled={loading}
            className="label-mono flex items-center gap-1.5 rounded-sm border border-line-strong px-3 py-1.5 text-[13px] text-paper-dim hover:border-electric hover:text-paper disabled:opacity-50"
          >
            <RotateCcw size={14} />
            Redo / update this stage
          </button>
          {nextStage && (
            <button
              onClick={() => goToStage(nextStage.key)}
              className="label-mono btn-accent px-4 py-1.5 text-[13px]"
            >
              Continue to {nextStage.label} →
            </button>
          )}
        </div>
      )}

      {isComplete(session, stage) && (
        <p className="mt-2 text-[13px] text-paper-faint">
          A redo keeps everything already captured — Atlas walks you through
          what&apos;s on file and asks what&apos;s changed.
        </p>
      )}

      {isComplete(session, "contentGuide") && (
        <div className="mt-4 border-l-[3px] border-sage bg-ink-raised px-4 py-3 text-sm text-sage">
          Onboarding complete — {session?.profile.businessName || session?.profile.name || "this client"}&apos;s
          profile, voice, ICA, and content guide are all captured.
        </div>
      )}
        </>
      )}

      <div className="mt-10">
        <h2 className="font-display mb-3 text-lg font-semibold text-paper">
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
