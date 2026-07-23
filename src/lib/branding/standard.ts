// Read-only accessors for the active branding standard, used by the parts
// of the app that must reference the user's brand SYNCHRONOUSLY: the prompt
// builders (buildClientContextBlock is a sync string builder) and the
// deliverable renderers (pdfStyles / buildEmailHtml). Rather than thread an
// async db read through all of those, this reads data/db.json directly and
// synchronously -- getDb() already re-reads that file on every call, so
// there's no in-memory source of truth being bypassed, and these are
// low-frequency server-render paths.
//
// Everything here degrades to DEFAULTS (the values previously hard-coded in
// pdf/styles.ts and steward/generate.ts) when there is no standard, or the
// file is missing/malformed, so nothing breaks before the user sets a brand.

import fs from "fs";
import path from "path";
import { BrandTokens, BrandingStandard } from "../types";
import { brandingPath } from "./storage";

// The color/font-stack fields are always resolved to a concrete value;
// bodyFont/headingFont stay optional since a matching Google Font may never
// be found (system font, proprietary font, network failure, etc.).
export type ResolvedBrandTokens = Required<
  Omit<BrandTokens, "bodyFont" | "headingFont">
> &
  Pick<BrandTokens, "bodyFont" | "headingFont">;

// The pre-branding look, used whenever no brand kit is set. Mapped from the
// app's light-theme design tokens (see src/app/globals.css) so an
// un-branded deliverable reads as part of the same product: KORE Signal
// blue accent, cool ink, cool hairlines. Paper stays white -- these are
// printable, client-facing documents and never follow the app's dark theme.
export const DEFAULT_TOKENS: ResolvedBrandTokens = {
  primary: "#0c77c2",
  ink: "#101725",
  paper: "#ffffff",
  muted: "#4a5567",
  line: "#e4e9f0",
  // Inter leads the stack to match the app UI. PDFs embed it (see
  // pdf/styles.ts). Word docs and HTML emails can't embed a font, so a reader
  // without Inter installed falls back gracefully to Helvetica/Arial.
  fontFamily: "Inter, Helvetica, Arial, sans-serif",
  headingFontFamily: "Inter, Helvetica, Arial, sans-serif",
};

const DB_PATH = path.join(process.cwd(), "data", "db.json");

function readStandard(): BrandingStandard | null {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const data = JSON.parse(raw) as { brandingStandard?: BrandingStandard | null };
    return data.brandingStandard ?? null;
  } catch {
    return null;
  }
}

// Merge only defined, non-empty fields over DEFAULT_TOKENS, so a partial
// extraction (or an older record missing a field) still yields a full,
// valid token set. bodyFont/headingFont are carried through as-is (not part
// of the string-only DEFAULT_TOKENS loop) since there's no default to fall
// back to -- callers treat their absence as "no custom font resolved".
export function resolveTokens(tokens?: BrandTokens): ResolvedBrandTokens {
  const merged: ResolvedBrandTokens = { ...DEFAULT_TOKENS };
  if (tokens) {
    const stringKeys = Object.keys(DEFAULT_TOKENS) as (keyof Omit<
      ResolvedBrandTokens,
      "bodyFont" | "headingFont"
    >)[];
    for (const key of stringKeys) {
      const value = tokens[key];
      if (typeof value === "string" && value.trim()) merged[key] = value.trim();
    }
    if (tokens.bodyFont) merged.bodyFont = tokens.bodyFont;
    if (tokens.headingFont) merged.headingFont = tokens.headingFont;
  }
  return merged;
}

// The active tokens, always a full set. Renderers call this at render time.
export function getActiveTokens(): ResolvedBrandTokens {
  return resolveTokens(readStandard()?.tokens);
}

export interface ActiveBranding {
  standard: BrandingStandard | null;
  tokens: ResolvedBrandTokens;
  designMd: string | null;
}

export function getActiveBranding(): ActiveBranding {
  const standard = readStandard();
  let designMd: string | null = null;
  if (standard) {
    try {
      designMd = fs.readFileSync(brandingPath(standard.mdFileName), "utf-8");
    } catch {
      designMd = null;
    }
  }
  return { standard, tokens: resolveTokens(standard?.tokens), designMd };
}

// Cap the design doc embedded into a prompt so a very long design system
// doesn't blow up every system prompt -- the token summary carries the
// hard values, the markdown is guidance.
const MAX_MD_CHARS = 6000;

// A prompt-injectable block describing the user's branding standard, so any
// agent producing a document or HTML output styles it to the brand. Empty
// string when no standard is set (nothing to inject).
export function brandingContextBlock(): string {
  const { standard, tokens, designMd } = getActiveBranding();
  if (!standard) return "";

  const mdSection = designMd
    ? `\n\nDesign system reference (follow this for any HTML or document output):\n${
        designMd.length > MAX_MD_CHARS ? `${designMd.slice(0, MAX_MD_CHARS)}\n…(truncated)` : designMd
      }`
    : "";

  return `## Branding standard (use for any document or HTML output)

The user has an active brand standard -- match it whenever you produce styled output (HTML, documents, decks, emails). Do not invent different colors or fonts.

Colors: primary/accent ${tokens.primary}, text ${tokens.ink}, background ${tokens.paper}, muted text ${tokens.muted}, borders ${tokens.line}
Fonts: body "${tokens.fontFamily}", headings "${tokens.headingFontFamily}"${mdSection}`;
}
