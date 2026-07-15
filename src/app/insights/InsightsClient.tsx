"use client";

import { useState } from "react";
import { InsightEntry } from "@/lib/types";
import { Sparkles, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Temporarily hidden while the feature is paused. Flip to re-enable.
const INSIGHTS_BRIEF_ENABLED = false;

export default function InsightsClient({
  initialInsights,
  dm2CloseMetrics,
}: {
  initialInsights: InsightEntry[];
  dm2CloseMetrics: { total: number; yes: number; no: number };
}) {
  const [insights, setInsights] = useState(initialInsights);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/insights", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate insights");
        return;
      }
      setInsights((prev) => [data.insight, ...prev]);
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sec-num mb-3">§ · INSIGHTS</div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="bleed-type text-paper">
            Insights
          </h1>
          {!INSIGHTS_BRIEF_ENABLED && (
            <p className="label-mono mt-1 text-[11px] text-gold">
              Section under development
            </p>
          )}
          <p className="mt-1 text-sm text-paper-dim">
            Claude reads your client and revenue data and tells you what to
            focus on.
          </p>
        </div>
        {INSIGHTS_BRIEF_ENABLED && (
          <button
            onClick={generate}
            disabled={loading}
            className="label-mono flex items-center gap-2 btn-accent px-3 py-1.5 text-[12px] disabled:opacity-50"
          >
            <Sparkles size={14} />
            {loading ? "Thinking..." : "Generate today's brief"}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 border-l-[3px] border-gold bg-ink-raised px-4 py-3 text-sm text-gold">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-display mb-3 text-lg font-bold uppercase tracking-wide text-paper">
          DM 2 Close Metrics
        </h2>
        <div className="hud-panel stack overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="label-mono border-b border-line text-left text-[11px] text-paper-faint">
                <th className="px-5 py-3 font-semibold">Total conversations</th>
                <th className="px-5 py-3 font-semibold">Yes (converted)</th>
                <th className="px-5 py-3 font-semibold">No (didn&apos;t convert)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-5 py-3 text-paper">{dm2CloseMetrics.total}</td>
                <td className="px-5 py-3 text-sage">{dm2CloseMetrics.yes}</td>
                <td className="px-5 py-3 font-semibold text-paper">{dm2CloseMetrics.no}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-paper-faint">
          Recorded whenever a DM 2 Close conversation thread is deleted and
          the coach answers whether it led to a conversion.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {insights.length === 0 && !error && (
          <div className="hud-panel stack p-8 text-center text-sm text-paper-faint">
            {INSIGHTS_BRIEF_ENABLED
              ? 'No insights generated yet. Add your Anthropic API key on the Settings page, then click "Generate today\'s brief".'
              : "Daily insight briefs are temporarily unavailable."}
          </div>
        )}
        {insights.map((insight) => (
          <div key={insight.id} className="hud-panel hud-panel-magenta stack p-5">
            <div className="label-mono mb-3 text-[12px] text-paper-faint">
              {formatDistanceToNow(new Date(insight.generatedAt), {
                addSuffix: true,
              })}
            </div>
            <p className="text-sm text-paper">{insight.summary}</p>

            {insight.priorities.length > 0 && (
              <div className="mt-4">
                <div className="label-mono mb-1.5 text-[11px] text-paper-faint">Priorities</div>
                <ul className="space-y-1 text-sm text-paper-dim">
                  {insight.priorities.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-electric">→</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insight.flags.length > 0 && (
              <div className="mt-4">
                <div className="label-mono mb-1.5 text-[11px] text-paper">[ ! ] Flags</div>
                <ul className="space-y-1 text-sm text-paper">
                  {insight.flags.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span>⚠</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
