import { getDb } from "@/lib/db";
import { computeLeadHealth, leadHealthCounts } from "@/lib/dm2close/health";
import { computeDiscoveryCallHealth } from "@/lib/hawk/discoveryCallHealth";
import DmHealthBadge from "@/components/DmHealthBadge";
import AgentDirectory from "@/components/AgentDirectory";
import ActivityFeed, { ActivityItem } from "@/components/ActivityFeed";
import CalendarPanel from "@/components/CalendarPanel";
import CircuitDivider from "@/components/CircuitDivider";
import { Search, PenLine, Send, ClipboardList } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MessagingSession, DmSession, HawkSession, StewardSession, SageSession } from "@/lib/types";

export const dynamic = "force-dynamic";

function since(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

function forClient(clientLabel: string) {
  return clientLabel === "No client linked" ? "" : ` for ${clientLabel}`;
}

type FeedSeed = Omit<ActivityItem, "updatedAtLabel"> & { updatedAt: string };

// A row in the merged "Leads needing attention" table -- combines DM 2
// Close leads (dmSessions) and Discovery Call leads (hawkSessions with a
// leadLabel) into one shared shape so they can be sorted/rendered together.
type AttentionRow = {
  id: string;
  leadLabel: string;
  clientLabel: string;
  health: "red" | "yellow";
  updatedAt: string;
  source: "DM 2 Close" | "Discovery Call";
  href: string;
};

function buildActivityFeed(
  sage: SageSession[],
  messaging: MessagingSession[],
  hawk: HawkSession[],
  steward: StewardSession[],
  dms: DmSession[],
): ActivityItem[] {
  const items: FeedSeed[] = [
    ...sage.map((s) => ({
      id: s.id,
      agentName: "Sage",
      icon: Search,
      label: s.clientLabel,
      summary: `Researching "${s.topic}"`,
      updatedAt: s.updatedAt,
    })),
    ...messaging.map((s) => ({
      id: s.id,
      agentName: "Quill",
      icon: PenLine,
      label: s.clientLabel,
      summary: `${s.complete ? "Drafted" : "Drafting"} "${s.piece.topic || s.piece.format || "a piece"}"`,
      updatedAt: s.updatedAt,
    })),
    ...hawk.map((s) => ({
      id: s.id,
      agentName: "Hawk",
      icon: Send,
      label: s.clientLabel,
      summary: `${s.complete ? "Drafted" : "Drafting"} ${s.asset.assetType || "an asset"}`,
      updatedAt: s.updatedAt,
    })),
    ...steward.map((s) => ({
      id: s.id,
      agentName: "Steward",
      icon: ClipboardList,
      label: s.clientLabel,
      summary: `${s.complete ? "Drafted" : "Drafting"} ${s.asset.docType || "a doc"}`,
      updatedAt: s.updatedAt,
    })),
    ...dms.map((s) => ({
      id: s.id,
      agentName: "Quill",
      icon: PenLine,
      label: s.leadLabel,
      summary: `${s.currentStage ?? "Active"} stage${forClient(s.clientLabel)}`,
      updatedAt: s.updatedAt,
      href: "/branding/dm-2-close",
    })),
  ];

  return items
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 8)
    .map(({ updatedAt, ...rest }) => ({ ...rest, updatedAtLabel: since(updatedAt) }));
}

export default async function OverviewPage() {
  const db = await getDb();
  const leads = db.data.dmSessions;
  const leadCounts = leadHealthCounts(leads);
  const outcomes = db.data.dmConversionOutcomes;
  const conversion = { total: outcomes.length, yes: outcomes.filter((o) => o.converted).length };
  const attention: AttentionRow[] = [
    ...leads.flatMap((s): AttentionRow[] => {
      const h = computeLeadHealth(s.messages);
      if (h !== "red" && h !== "yellow") return [];
      return [
        {
          id: s.id,
          leadLabel: s.leadLabel,
          clientLabel: s.clientLabel,
          health: h,
          updatedAt: s.updatedAt,
          source: "DM 2 Close",
          href: "/branding/dm-2-close",
        },
      ];
    }),
    ...db.data.hawkSessions
      .filter((s) => s.leadLabel)
      .flatMap((s): AttentionRow[] => {
        const h = computeDiscoveryCallHealth(s);
        if (h !== "red" && h !== "yellow") return [];
        return [
          {
            id: s.id,
            leadLabel: s.leadLabel!,
            clientLabel: s.clientLabel,
            health: h,
            updatedAt: s.updatedAt,
            source: "Discovery Call",
            href: "/branding/discovery-call",
          },
        ];
      }),
  ].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  const activityItems = buildActivityFeed(
    db.data.sageSessions,
    db.data.messagingSessions,
    db.data.hawkSessions,
    db.data.stewardSessions,
    db.data.dmSessions,
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="bleed-type text-paper">Overview</h1>
        <p className="mt-2 text-sm text-paper-dim">
          Your business, and the team running it, in one view.
        </p>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-paper">
          Today &amp; this week
        </h2>
        <CalendarPanel />
      </div>

      <div className="mt-10">
        <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-paper">
          Leads needing attention
        </h2>
        {attention.length === 0 ? (
          <div className="hud-panel stack p-8 text-center text-sm text-paper-dim">
            No leads need attention right now. Start a thread from DM 2 Close or Discovery Call.
          </div>
        ) : (
          <div className="hud-panel stack overflow-hidden">
            <table className="w-full text-sm">
              <thead className="label-mono bg-paper text-left text-[11px] text-ink">
                <tr>
                  <th className="px-4 py-3 font-semibold">Lead</th>
                  <th className="px-4 py-3 font-semibold">Health</th>
                  <th className="px-4 py-3 font-semibold">Last update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-ink">
                {attention.slice(0, 6).map((row) => {
                  const clientContext = forClient(row.clientLabel).replace(/^ for /, "");
                  return (
                    <tr key={`${row.source}-${row.id}`} className="hover:bg-paper/[0.03]">
                      <td className="px-4 py-3">
                        <Link href={row.href} className="font-medium text-paper hover:text-electric">
                          {row.leadLabel}
                        </Link>
                        <div className="label-mono mt-0.5 text-[10px] text-paper-faint">
                          {row.source}
                          {clientContext && ` · ${clientContext}`}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <DmHealthBadge status={row.health} />
                      </td>
                      <td className="px-4 py-3 text-paper-dim">{since(row.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="hud-panel stack-sm mt-10 flex flex-col overflow-hidden sm:flex-row">
        <div className="flex-1 border-b border-line px-5 py-3 sm:border-b-0 sm:border-r">
          <div className="label-mono text-[11px] text-paper-faint">Active leads</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-paper">
            {leads.length}
          </div>
        </div>
        <div className="flex-1 border-b border-line px-5 py-3 sm:border-b-0 sm:border-r">
          <div className="label-mono text-[11px] text-paper-faint">Lead health mix</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums">
            <span className="text-dm-health-green">{leadCounts.green}</span>
            <span className="text-paper-faint">/</span>
            <span className="text-dm-health-yellow">{leadCounts.yellow}</span>
            <span className="text-paper-faint">/</span>
            <span className="text-dm-health-red">{leadCounts.red}</span>
          </div>
        </div>
        {/* The one blue spend on this view: conversion rate as the Signal Data panel. */}
        <div className="flex-1 px-5 py-3 bg-clay">
          <div className="label-mono text-[11px] text-signal-fg/80">Conversion rate</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-signal-fg">
            {conversion.yes}/{conversion.total}
          </div>
        </div>
      </div>

      <CircuitDivider />

      <div>
        <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-paper">
          Recent activity
        </h2>
        <ActivityFeed items={activityItems} />
      </div>

      <div className="mt-10">
        <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-paper">
          Agent directory
        </h2>
        <AgentDirectory />
      </div>
    </div>
  );
}
