// Selectable Claude model aliases for the Settings page. These are passed
// straight through to the local `claude` CLI's --model flag (see
// src/lib/claude-cli.ts) or the Anthropic SDK client (src/lib/anthropic.ts) --
// short aliases, not full dated model IDs, so the CLI/subscription always
// resolves to its current release.

export type ModelKey = "sonnet" | "opus" | "haiku";

export const DEFAULT_MODEL: ModelKey = "sonnet";

export type ModelMeta = {
  key: ModelKey;
  label: string;
  blurb: string;
};

export const MODELS: ModelMeta[] = [
  {
    key: "sonnet",
    label: "Sonnet",
    blurb: "Default — balanced speed and quality for most agent work.",
  },
  {
    key: "opus",
    label: "Opus",
    blurb: "Slower, strongest reasoning — use for the hardest research/strategy tasks.",
  },
  {
    key: "haiku",
    label: "Haiku",
    blurb: "Fastest and cheapest — use for simple, high-volume turns.",
  },
];

export function isModelKey(v: unknown): v is ModelKey {
  return typeof v === "string" && MODELS.some((m) => m.key === v);
}
