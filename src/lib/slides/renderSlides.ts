// Renders a messaging piece into on-brand PNGs. Satori turns a simple flex
// layout + fonts into an SVG (glyphs as vector paths), then sharp rasterizes
// that SVG to PNG -- so no font needs to be installed at raster time. Colors/
// fonts come from the active branding standard when set, else the shared
// DEFAULT_TOKENS (see src/lib/branding/standard.ts); a bundled Inter (OFL) is
// the always-present font fallback.
//
// Two shapes: a carousel renders N slides (index shown, CTA on the last one);
// a single image post (IG image / LinkedIn) renders exactly ONE card whose
// text density follows the piece's imageCardStyle. When the session has an
// uploaded photo, it's composited as a full-bleed background behind a dark
// scrim with the text switched to white.

import fs from "fs";
import path from "path";
import React from "react";
import satori from "satori";
import sharp from "sharp";
import { CarouselSlide, MessagingPiece } from "../types";
import { getActiveTokens, ResolvedBrandTokens } from "../branding/standard";
import { brandingPath } from "../branding/storage";
import { deliverablePath } from "../pdf/generate";

const FONT_DIR = path.join(process.cwd(), "src", "lib", "slides", "fonts");
const WIDTH = 1080;
const HEIGHT = 1350; // 4:5 portrait -- the best-performing IG carousel ratio
const MAX_SLIDES = 12;

type FontDef = {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
};

// Per-slide display flags, computed once per render from the piece format and
// (for single images) the chosen imageCardStyle.
type SlideFlags = {
  showIndex: boolean;
  showCta: boolean;
  showBody: boolean;
};

export type RenderOpts = {
  // Absolute path to an uploaded photo to use as the full-bleed background.
  backgroundImagePath?: string;
};

function isCarouselFormat(format?: string): boolean {
  return (format || "").toLowerCase().includes("carousel");
}

// Load the always-present Inter fallback plus, when the brand standard has
// resolved font files, the brand's heading/body fonts. Returns the family
// names the template should reference.
function loadFonts(tokens: ResolvedBrandTokens): {
  fonts: FontDef[];
  headingFamily: string;
  bodyFamily: string;
} {
  const fonts: FontDef[] = [
    {
      name: "Inter",
      data: fs.readFileSync(path.join(FONT_DIR, "inter-latin-400-normal.woff")),
      weight: 400,
      style: "normal",
    },
    {
      name: "Inter",
      data: fs.readFileSync(path.join(FONT_DIR, "inter-latin-700-normal.woff")),
      weight: 700,
      style: "normal",
    },
  ];

  let headingFamily = "Inter";
  let bodyFamily = "Inter";

  const hf = tokens.headingFont;
  if (hf?.regularFileName || hf?.boldFileName) {
    try {
      if (hf.regularFileName)
        fonts.push({ name: "BrandHeading", data: fs.readFileSync(brandingPath(hf.regularFileName)), weight: 400, style: "normal" });
      if (hf.boldFileName)
        fonts.push({ name: "BrandHeading", data: fs.readFileSync(brandingPath(hf.boldFileName)), weight: 700, style: "normal" });
      headingFamily = "BrandHeading";
    } catch {
      // brand font file missing/unreadable -- stay on Inter
    }
  }

  const bf = tokens.bodyFont;
  if (bf?.regularFileName || bf?.boldFileName) {
    try {
      if (bf.regularFileName)
        fonts.push({ name: "BrandBody", data: fs.readFileSync(brandingPath(bf.regularFileName)), weight: 400, style: "normal" });
      if (bf.boldFileName)
        fonts.push({ name: "BrandBody", data: fs.readFileSync(brandingPath(bf.boldFileName)), weight: 700, style: "normal" });
      bodyFamily = "BrandBody";
    } catch {
      // stay on Inter
    }
  }

  return { fonts, headingFamily, bodyFamily };
}

// The first sentence (or the whole thing if there's no terminator) -- used to
// derive a single-image card's text when no structured slide was extracted.
function firstSentence(text: string): string {
  const t = (text || "").trim();
  if (!t) return "";
  const m = t.match(/^[\s\S]*?[.!?](\s|$)/);
  return (m ? m[0] : t).trim();
}

// Turn a piece into the cards to render. A single-image post is always exactly
// one card; a carousel prefers the extracted `slides`, else splits finalText
// on blank lines (first line of a block = headline).
export function pieceToSlides(piece: MessagingPiece): CarouselSlide[] {
  if (!isCarouselFormat(piece.format)) {
    const s0 = piece.slides && piece.slides.length > 0 ? piece.slides[0] : undefined;
    const text = (piece.finalText || "").trim();
    const headline = (s0?.headline || piece.topic || firstSentence(text) || "").trim();
    // Only derive a body from finalText when we didn't already spend the first
    // sentence on the headline, so hook + intro don't come out identical.
    const body = (s0?.body || (piece.topic ? firstSentence(text) : "") || "").trim();
    return [{ headline, body }];
  }

  if (piece.slides && piece.slides.length > 0) {
    return piece.slides.slice(0, MAX_SLIDES).map((s) => ({
      headline: (s.headline || "").trim(),
      body: (s.body || "").trim(),
    }));
  }

  const text = (piece.finalText || "").trim();
  if (!text) return [{ headline: piece.topic || "", body: "" }];

  const blocks = text
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, MAX_SLIDES);

  if (blocks.length === 0) return [{ headline: piece.topic || "", body: text }];

  return blocks.map((block) => {
    const lines = block.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) return { headline: lines[0], body: lines.slice(1).join(" ") };
    return { headline: "", body: lines[0] || block };
  });
}

// Rough font-size ramp so long headlines still fit without measuring text.
function headlineSize(text: string): number {
  const n = text.length;
  if (n <= 24) return 72;
  if (n <= 48) return 60;
  if (n <= 80) return 50;
  return 42;
}

const h = React.createElement;

function slideElement(
  slide: CarouselSlide,
  index: number,
  total: number,
  tokens: ResolvedBrandTokens,
  cta: string | undefined,
  headingFamily: string,
  bodyFamily: string,
  flags: SlideFlags,
  bgDataUri: string | undefined,
): React.ReactElement {
  const headline = slide.headline || "";
  const body = slide.body || "";
  const hasBg = !!bgDataUri;

  const headlineColor = hasBg ? "#ffffff" : tokens.ink;
  const bodyColor = hasBg ? "#e8e8e8" : tokens.muted;

  const content: React.ReactElement[] = [];
  if (headline) {
    content.push(
      h("div", {
        key: "hl",
        style: {
          fontFamily: headingFamily,
          fontWeight: 700,
          fontSize: headlineSize(headline),
          lineHeight: 1.12,
          color: headlineColor,
        },
        children: headline,
      }),
    );
  }
  if (flags.showBody && body) {
    content.push(
      h("div", {
        key: "bd",
        style: {
          fontFamily: bodyFamily,
          fontSize: 34,
          lineHeight: 1.5,
          color: bodyColor,
          marginTop: headline ? 32 : 0,
        },
        children: body,
      }),
    );
  }
  if (flags.showCta && cta && cta.trim()) {
    content.push(
      h("div", {
        key: "cta",
        style: {
          display: "flex",
          marginTop: 44,
          alignSelf: "flex-start",
          backgroundColor: tokens.primary,
          color: "#ffffff",
          fontFamily: headingFamily,
          fontWeight: 700,
          fontSize: 30,
          padding: "20px 34px",
        },
        children: cta.trim(),
      }),
    );
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  // Top accent bar, centered content, then either the slide index or an empty
  // spacer (keeps the top/bottom balance without a "01 / 01" on single cards).
  const columnChildren: React.ReactElement[] = [
    h("div", {
      key: "bar",
      style: { display: "flex", width: 180, height: 14, backgroundColor: tokens.primary },
    }),
    h("div", {
      key: "content",
      style: { display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 },
      children: content.length > 0 ? content : [h("div", { key: "empty", children: "" })],
    }),
    flags.showIndex
      ? h("div", {
          key: "idx",
          style: {
            fontFamily: bodyFamily,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 4,
            color: tokens.primary,
          },
          children: `${pad(index + 1)} / ${pad(total)}`,
        })
      : h("div", { key: "idx", style: { display: "flex", height: 26 } }),
  ];

  if (!hasBg) {
    return h("div", {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: tokens.paper,
        padding: 96,
        fontFamily: bodyFamily,
      },
      children: columnChildren,
    });
  }

  // Full-bleed photo, dark scrim, then the content frame on top.
  return h("div", {
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      position: "relative",
      backgroundImage: `url(${bgDataUri})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      fontFamily: bodyFamily,
    },
    children: [
      h("div", {
        key: "scrim",
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          backgroundColor: "rgba(0,0,0,0.55)",
        },
      }),
      h("div", {
        key: "frame",
        style: {
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 96,
        },
        children: columnChildren,
      }),
    ],
  });
}

// Render every card of a piece to a PNG under data/deliverables/, returning
// the file names in order.
export async function renderSlidePngs(
  sessionId: string,
  piece: MessagingPiece,
  opts: RenderOpts = {},
): Promise<string[]> {
  const slides = pieceToSlides(piece);
  const tokens = getActiveTokens();
  const { fonts, headingFamily, bodyFamily } = loadFonts(tokens);

  let bgDataUri: string | undefined;
  if (opts.backgroundImagePath) {
    try {
      const buf = fs.readFileSync(opts.backgroundImagePath);
      bgDataUri = `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      // missing/unreadable -- render on the plain brand card instead
    }
  }

  const carousel = isCarouselFormat(piece.format);
  const total = slides.length;
  const cardStyle = piece.imageCardStyle || "hook-cta";

  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
  fs.mkdirSync(path.dirname(deliverablePath(`${safeId}-slide-1.png`)), { recursive: true });

  const fileNames: string[] = [];
  for (let i = 0; i < total; i++) {
    const flags: SlideFlags = carousel
      ? { showIndex: total > 1, showCta: i === total - 1, showBody: true }
      : {
          showIndex: false,
          showCta: cardStyle !== "headline-only",
          showBody: cardStyle === "hook-intro",
        };
    const el = slideElement(slides[i], i, total, tokens, piece.cta, headingFamily, bodyFamily, flags, bgDataUri);
    const svg = await satori(el, { width: WIDTH, height: HEIGHT, fonts });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const fileName = `${safeId}-slide-${i + 1}.png`;
    fs.writeFileSync(deliverablePath(fileName), png);
    fileNames.push(fileName);
  }
  return fileNames;
}
