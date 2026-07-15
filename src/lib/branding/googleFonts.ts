// Resolves a brand font name (from the extracted BrandTokens font stacks) to
// an actual downloadable TTF file via the Google Fonts API, cached on disk
// under data/branding/ so PDF rendering (pdf/styles.ts) can register it with
// @react-pdf/renderer synchronously at render time.
//
// Best-effort only: returns null for anything unresolvable -- generic/system
// stacks, fonts not on Google Fonts (proprietary/Adobe fonts, typos), or any
// network failure -- so callers fall back to the default Helvetica-only
// look that existed before this feature, never a hard error.

import { BrandFontFile } from "../types";
import { customFontName } from "./fontName";
import { saveBinary } from "./storage";

// Google Fonts' CSS API serves a format matched to the request's User-Agent
// (WOFF2 to modern browsers, EOT to old IE user agents, etc.) -- none of
// which @react-pdf/renderer's font engine can parse. Sending no User-Agent
// at all (verified against the live API) gets the plain TTF URLs back,
// which it does support.
const WEIGHTS = [400, 700] as const;

interface FontFaceMatch {
  weight: number;
  url: string;
}

function parseFontFaceUrls(css: string): FontFaceMatch[] {
  const matches: FontFaceMatch[] = [];
  const blockRe = /@font-face\s*{([^}]*)}/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(css))) {
    const body = block[1];
    const weightMatch = /font-weight:\s*(\d+)/.exec(body);
    const urlMatch = /url\((https:\/\/[^)]+)\)/.exec(body);
    if (weightMatch && urlMatch) {
      matches.push({ weight: Number(weightMatch[1]), url: urlMatch[1] });
    }
  }
  return matches;
}

// Generous, but bounded -- a stalled font lookup shouldn't hang brand kit
// generation (which already runs a multi-minute CLI turn) indefinitely.
const FETCH_TIMEOUT_MS = 15_000;

async function fetchFontCss(family: string): Promise<string | null> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family,
  )}:wght@${WEIGHTS.join(";")}&display=swap`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return null;
  return res.text();
}

async function downloadFont(url: string): Promise<Buffer | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

// Fetches (and caches) the brand font matching a CSS font-family stack, e.g.
// "Poppins, sans-serif". `cacheKeyPrefix` should be unique per branding
// standard + slot (e.g. "brand-123-body") so regenerating the brand kit
// doesn't collide with a previous standard's cached files.
export async function resolveBrandFont(
  stack: string | undefined,
  cacheKeyPrefix: string,
): Promise<BrandFontFile | null> {
  const family = customFontName(stack);
  if (!family) return null;

  try {
    const css = await fetchFontCss(family);
    if (!css) return null;

    const faces = parseFontFaceUrls(css);
    const regular = faces.find((f) => f.weight === 400) ?? faces[0];
    if (!regular) return null;
    const bold = faces.find((f) => f.weight === 700);

    const regularBuffer = await downloadFont(regular.url);
    if (!regularBuffer) return null;
    const regularFileName = `${cacheKeyPrefix}-400.ttf`;
    saveBinary(regularFileName, regularBuffer);

    let boldFileName: string | undefined;
    if (bold) {
      const boldBuffer = await downloadFont(bold.url);
      if (boldBuffer) {
        boldFileName = `${cacheKeyPrefix}-700.ttf`;
        saveBinary(boldFileName, boldBuffer);
      }
    }

    return { family, regularFileName, boldFileName };
  } catch {
    return null;
  }
}
