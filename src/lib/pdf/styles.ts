// Shared styling for generated deliverable PDFs. Light background by
// design -- these are printable client-facing documents, unlike the app's
// dark UI. Colors and (when available) fonts are driven by the active
// branding standard (via buildPdfStyles below); a bundled default keeps the
// pre-branding look.
//
// Fonts: @react-pdf/renderer can only use fonts it has registered
// (Helvetica is built in). Precedence: a brand kit's cached font file (see
// branding/googleFonts.ts) wins; otherwise the bundled Inter (registered by
// ensureInterDefault below) is the default, matching the app UI; if even that
// asset is missing, styles fall back to Helvetica so a PDF still renders.

import { Font, StyleSheet } from "@react-pdf/renderer";
import fs from "fs";
import path from "path";
import { BrandTokens, BrandFontFile } from "../types";
import { DEFAULT_TOKENS } from "../branding/standard";
import { brandingPath } from "../branding/storage";

// Per-field fallback for buildPdfStyles; kept in sync with DEFAULT_TOKENS in
// branding/standard.ts. Mapped from the app's light-theme tokens so
// un-branded PDFs read as part of the same product. Paper stays white --
// these are printable client documents, not the app's dark UI.
export const BRAND = {
  ink: "#101725",
  paper: "#ffffff",
  muted: "#4a5567",
  line: "#e4e9f0",
  electric: "#0c77c2",
};

export type PdfStyles = ReturnType<typeof buildPdfStyles>;

// Families already registered with react-pdf's global Font registry in
// this process, keyed by the cached regular-file name -- registering the
// same family twice is wasted work, not an error, but this avoids it.
const registeredFontFiles = new Set<string>();

// The bundled Inter (reused from the slides renderer's font dir) is the
// default deliverable typeface, matching the app UI. Registered once per
// process. Returns "Inter" on success, or "Helvetica" if the asset is
// missing/unreadable so a PDF never fails to render over a font.
const INTER_FONT_DIR = path.join(process.cwd(), "src", "lib", "slides", "fonts");
let interRegistered: boolean | null = null;
function ensureInterDefault(): string {
  if (interRegistered === null) {
    try {
      const regular = path.join(INTER_FONT_DIR, "inter-latin-400-normal.woff");
      const bold = path.join(INTER_FONT_DIR, "inter-latin-700-normal.woff");
      if (!fs.existsSync(regular) || !fs.existsSync(bold)) {
        interRegistered = false;
      } else {
        Font.register({
          family: "Inter",
          fonts: [
            { src: regular, fontWeight: "normal" },
            { src: bold, fontWeight: "bold" },
          ],
        });
        interRegistered = true;
      }
    } catch {
      interRegistered = false;
    }
  }
  return interRegistered ? "Inter" : "Helvetica";
}

// Registers a cached brand font with react-pdf, returning the family name
// to use in styles. Falls back to `fallbackFamily` (a react-pdf built-in)
// whenever there's no font to register or the cached file is missing/
// unreadable, so a broken cache never breaks PDF rendering.
function registerFont(fontFile: BrandFontFile | undefined, fallbackFamily: string): string {
  if (!fontFile?.regularFileName) return fallbackFamily;

  const regularPath = brandingPath(fontFile.regularFileName);
  if (!fs.existsSync(regularPath)) return fallbackFamily;

  if (!registeredFontFiles.has(fontFile.regularFileName)) {
    const fonts: { src: string; fontWeight?: "normal" | "bold" }[] = [
      { src: regularPath, fontWeight: "normal" },
    ];
    const boldPath = fontFile.boldFileName ? brandingPath(fontFile.boldFileName) : null;
    if (boldPath && fs.existsSync(boldPath)) {
      fonts.push({ src: boldPath, fontWeight: "bold" });
    }
    try {
      Font.register({ family: fontFile.family, fonts });
      registeredFontFiles.add(fontFile.regularFileName);
    } catch {
      return fallbackFamily;
    }
  }
  return fontFile.family;
}

// Build the PDF stylesheet from a resolved token set. Maps the brand's
// `primary` onto the electric accent; falls back per-field to the defaults.
export function buildPdfStyles(tokens?: BrandTokens) {
  const brand = {
    ink: tokens?.ink || BRAND.ink,
    paper: tokens?.paper || BRAND.paper,
    muted: tokens?.muted || BRAND.muted,
    line: tokens?.line || BRAND.line,
    electric: tokens?.primary || BRAND.electric,
  };
  // Default to bundled Inter. When Inter registered, the heading also uses
  // "Inter" and gets its weight from fontWeight:"bold" (a real bold face is
  // registered). Only when Inter is unavailable do we fall back to the
  // built-in "Helvetica" / "Helvetica-Bold" pair (Helvetica-Bold is its own
  // font name, not a weight variant -- see headingFontWeight in makeStyles).
  const interDefault = ensureInterDefault();
  const bodyFamily = registerFont(tokens?.bodyFont, interDefault);
  const headingFamily = registerFont(
    tokens?.headingFont,
    interDefault === "Inter" ? "Inter" : "Helvetica-Bold",
  );
  return makeStyles(brand, bodyFamily, headingFamily);
}

function makeStyles(
  BRAND: {
    ink: string;
    paper: string;
    muted: string;
    line: string;
    electric: string;
  },
  bodyFamily: string,
  headingFamily: string,
) {
  // "Helvetica-Bold" is its own built-in font name in react-pdf, not a
  // fontWeight variant of "Helvetica" -- only apply fontWeight when a real
  // custom family was registered (with a bold face alongside the regular).
  const headingFontWeight = headingFamily === "Helvetica-Bold" ? undefined : "bold";
  return StyleSheet.create({
  page: {
    backgroundColor: BRAND.paper,
    color: BRAND.ink,
    padding: 48,
    fontSize: 10.5,
    fontFamily: bodyFamily,
    lineHeight: 1.5,
  },
  eyebrow: {
    fontSize: 9,
    color: BRAND.electric,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontFamily: headingFamily,
    fontWeight: headingFontWeight,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10.5,
    color: BRAND.muted,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: headingFamily,
    fontWeight: headingFontWeight,
    marginTop: 18,
    marginBottom: 8,
    color: BRAND.ink,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.electric,
    paddingBottom: 4,
  },
  fieldLabel: {
    fontSize: 9,
    color: BRAND.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 10.5,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 10.5,
    marginBottom: 8,
  },
  table: {
    marginTop: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: BRAND.line,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.line,
  },
  tableRowLast: {
    flexDirection: "row",
  },
  tableHeaderCell: {
    flex: 1,
    padding: 6,
    fontSize: 8.5,
    fontFamily: headingFamily,
    fontWeight: headingFontWeight,
    backgroundColor: "#f1f5f9",
    textTransform: "uppercase",
  },
  tableCell: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    borderLeftWidth: 1,
    borderLeftColor: BRAND.line,
  },
  tableCellFirst: {
    flex: 1,
    padding: 6,
    fontSize: 9,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: BRAND.muted,
    borderTopWidth: 1,
    borderTopColor: BRAND.line,
    paddingTop: 8,
  },
  });
}

// Default (pre-branding) stylesheet, for any caller that doesn't resolve the
// active tokens itself. The PDF components call buildPdfStyles(getActiveTokens())
// at render time so their output tracks the active branding standard.
export const pdfStyles = buildPdfStyles(DEFAULT_TOKENS);
