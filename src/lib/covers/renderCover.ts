// Renders a digital-product / lead-magnet COVER to an on-brand PNG. Same
// satori -> sharp pipeline as the slide renderer (src/lib/slides/renderSlides.ts):
// satori turns a flex layout + fonts into an SVG (glyphs as vector paths),
// then sharp rasterizes to PNG, so no font needs installing at raster time.
// Colors/fonts come from the active branding standard, else DEFAULT_TOKENS.
//
// The cover is A4 portrait so one image serves both as a standalone download
// AND as a crisp full-bleed page 1 of the generated PDF. All text is rendered
// here (never by an image model) so titles stay perfect and on-brand; an
// optional uploaded/AI-generated background is composited full-bleed behind a
// dark scrim with the text switched to white.

import fs from "fs";
import path from "path";
import React from "react";
import satori from "satori";
import sharp from "sharp";
import { DigitalProductAsset } from "../types";
import { getActiveTokens, ResolvedBrandTokens } from "../branding/standard";
import { brandingPath } from "../branding/storage";
import { deliverablePath } from "../pdf/generate";
import { businessLabel } from "../pdf/documentIdentity";

// Reuse the bundled Inter (OFL) fonts that ship with the slide renderer.
const FONT_DIR = path.join(process.cwd(), "src", "lib", "slides", "fonts");
const WIDTH = 1240;
const HEIGHT = 1754; // A4 portrait ratio (1:√2), the shape the PDF page uses

type FontDef = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };

export type CoverRenderOpts = {
  // Absolute path to a photo to composite full-bleed behind the cover text.
  backgroundImagePath?: string;
};

function loadFonts(tokens: ResolvedBrandTokens): {
  fonts: FontDef[];
  headingFamily: string;
  bodyFamily: string;
} {
  const fonts: FontDef[] = [
    { name: "Inter", data: fs.readFileSync(path.join(FONT_DIR, "inter-latin-400-normal.woff")), weight: 400, style: "normal" },
    { name: "Inter", data: fs.readFileSync(path.join(FONT_DIR, "inter-latin-700-normal.woff")), weight: 700, style: "normal" },
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
      // brand font file missing -- stay on Inter
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

// Rough size ramp so long titles still fit without measuring text.
function titleSize(text: string): number {
  const n = text.length;
  if (n <= 20) return 132;
  if (n <= 36) return 104;
  if (n <= 60) return 82;
  if (n <= 90) return 64;
  return 52;
}

const h = React.createElement;

function coverElement(
  asset: DigitalProductAsset,
  clientLabel: string,
  tokens: ResolvedBrandTokens,
  headingFamily: string,
  bodyFamily: string,
  bgDataUri: string | undefined,
): React.ReactElement {
  const hasBg = !!bgDataUri;
  const title = asset.title || "Digital Product";
  const eyebrow = (asset.productType || "").trim();
  const subtitle = (asset.subtitle || "").trim();
  const byline = businessLabel(clientLabel);

  const headingColor = hasBg ? "#ffffff" : tokens.ink;
  const subColor = hasBg ? "#e8e8e8" : tokens.muted;
  const eyebrowColor = tokens.primary;

  // Top block: eyebrow + accent bar.
  const topChildren: React.ReactElement[] = [
    h("div", {
      key: "bar",
      style: { display: "flex", width: 200, height: 16, backgroundColor: tokens.primary },
    }),
  ];
  if (eyebrow) {
    topChildren.push(
      h("div", {
        key: "eyebrow",
        style: {
          marginTop: 28,
          fontFamily: bodyFamily,
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: eyebrowColor,
        },
        children: eyebrow.toUpperCase(),
      }),
    );
  }

  // Middle block: title + subtitle.
  const midChildren: React.ReactElement[] = [
    h("div", {
      key: "title",
      style: {
        fontFamily: headingFamily,
        fontWeight: 700,
        fontSize: titleSize(title),
        lineHeight: 1.08,
        color: headingColor,
      },
      children: title,
    }),
  ];
  if (subtitle) {
    midChildren.push(
      h("div", {
        key: "subtitle",
        style: {
          marginTop: 40,
          fontFamily: bodyFamily,
          fontSize: 40,
          lineHeight: 1.4,
          color: subColor,
        },
        children: subtitle,
      }),
    );
  }

  // Bottom block: byline.
  const bottomChildren: React.ReactElement[] = [];
  if (byline) {
    bottomChildren.push(
      h("div", {
        key: "byline",
        style: {
          fontFamily: bodyFamily,
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: 2,
          color: hasBg ? "#ffffff" : tokens.ink,
        },
        children: byline,
      }),
    );
  } else {
    bottomChildren.push(h("div", { key: "byline", style: { display: "flex", height: 30 } }));
  }

  const columnChildren: React.ReactElement[] = [
    h("div", { key: "top", style: { display: "flex", flexDirection: "column" }, children: topChildren }),
    h("div", { key: "mid", style: { display: "flex", flexDirection: "column" }, children: midChildren }),
    h("div", { key: "bottom", style: { display: "flex", flexDirection: "column" }, children: bottomChildren }),
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
        padding: 120,
        fontFamily: bodyFamily,
      },
      children: columnChildren,
    });
  }

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
        style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", backgroundColor: "rgba(0,0,0,0.55)" },
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
          padding: 120,
        },
        children: columnChildren,
      }),
    ],
  });
}

// Render the cover PNG under data/deliverables/, returning its file name.
export async function renderCoverPng(
  sessionId: string,
  asset: DigitalProductAsset,
  clientLabel: string,
  opts: CoverRenderOpts = {},
): Promise<string> {
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

  const el = coverElement(asset, clientLabel, tokens, headingFamily, bodyFamily, bgDataUri);
  const svg = await satori(el, { width: WIDTH, height: HEIGHT, fonts });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
  const fileName = `${safeId}-cover.png`;
  fs.mkdirSync(path.dirname(deliverablePath(fileName)), { recursive: true });
  fs.writeFileSync(deliverablePath(fileName), png);
  return fileName;
}
