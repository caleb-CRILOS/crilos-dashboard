// Claude-powered insights: takes the current state of the dashboard data
// (clients, health counts, revenue trend) and asks Claude to summarize it
// into a short daily brief -- the "AI reads your business and tells you
// what to focus on" piece from the video.

import Anthropic from "@anthropic-ai/sdk";
import { Client, RevenueSnapshot, InsightEntry } from "./types";
import { healthCounts } from "./health";

// Default model. Anthropic periodically ships newer models -- if this ID
// is no longer available on your account, check
// https://docs.claude.com/en/docs/about-claude/models for the current
// list and set ANTHROPIC_MODEL in .env.local to override.
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

export async function generateInsights(
  apiKey: string,
  model: string | undefined,
  clients: Client[],
  revenueSnapshots: RevenueSnapshot[],
): Promise<InsightEntry> {
  const anthropic = new Anthropic({ apiKey });
  const counts = healthCounts(clients);
  const redClients = clients.filter((c) => c.health === "red");
  const latestSnapshot = revenueSnapshots[revenueSnapshots.length - 1];

  const dataSummary = {
    totalClients: clients.length,
    healthCounts: counts,
    redClients: redClients.map((c) => ({
      name: c.name,
      lastActivityAt: c.lastActivityAt,
      paymentStatus: c.paymentStatus,
    })),
    latestSnapshot,
  };

  const message = await anthropic.messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: 1024,
    system:
      "You are a business analyst for a solo coaching/consulting business. " +
      "You will be given a JSON snapshot of client health and revenue data. " +
      "Respond ONLY with valid JSON matching this TypeScript type, no prose " +
      "outside the JSON: " +
      '{ "summary": string, "priorities": string[], "flags": string[] }. ' +
      "'summary' is 2-3 sentences on overall business health. 'priorities' " +
      "is 3-5 concrete, specific actions to take today, referencing client " +
      "names where relevant. 'flags' is a list of specific risks (e.g. " +
      "named at-risk clients, payment issues, declining trend).",
    messages: [
      {
        role: "user",
        content: JSON.stringify(dataSummary),
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";

  let parsed: { summary: string; priorities: string[]; flags: string[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      summary: raw.slice(0, 500),
      priorities: [],
      flags: ["Could not parse a structured response from Claude."],
    };
  }

  return {
    id: `insight-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    summary: parsed.summary ?? "",
    priorities: parsed.priorities ?? [],
    flags: parsed.flags ?? [],
  };
}
