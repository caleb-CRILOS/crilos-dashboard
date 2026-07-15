// Turns an uploaded brand image into the active branding standard by having
// Atlas (the local Claude CLI) look at the image and WRITE a self-contained
// design.html + design.md, then extracting a small token set for the
// renderers. The CLI is text-only, so vision comes from the Read tool
// pointed at the image saved inside a per-run scratch dir; Atlas writes the
// two files itself (rather than us round-tripping large HTML through JSON,
// which risks truncation/escaping bugs). Only the compact color/font tokens
// go through extractStructured.
//
// This module just produces the new files on disk under data/branding/ and
// returns the record; the API route owns db.json (writing the new pointer
// and deleting the previous standard's files).

import fs from "fs";
import path from "path";
import { extractStructured, makeRunDir, sendTurn } from "../claude-cli";
import { BrandTokens, BrandingStandard } from "../types";
import { saveBinary, saveText } from "./storage";
import { resolveBrandFont } from "./googleFonts";

const BRAND_KIT_SYSTEM_PROMPT = `You are Atlas, a brand and design-systems partner for a coach or
consultant. You are given a single brand image (a logo, screenshot,
moodboard, or brand asset). Your job is to reverse-engineer a reusable
design system from it: the color palette, typography feel, spacing, and
overall visual voice.

You produce two files, and only these two files:
1. design.html -- a single, fully self-contained HTML page (all CSS
   inline in a <style> tag, no external fonts/scripts/images) that both
   DOCUMENTS the design system (color swatches with hex values,
   type scale, buttons, cards, spacing) and demonstrates it. It should
   look finished and be safe to open on its own.
2. design.md -- a markdown design-system doc: brand voice in one line,
   a color table (name, hex, usage), typography, spacing, and simple
   usage rules another AI could follow when generating on-brand output.

Derive real hex values from the image. Be decisive and consistent -- the
same palette must appear in both files.`;

// Recognized image extensions; anything else is coerced to .png (the CLI's
// Read tool infers type from content, and browsers/upload already validated).
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function imageExtension(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext) ? ext : ".png";
}

// JSON schema for the token extraction pass. All optional -- a partial
// result is merged over DEFAULT_TOKENS by resolveTokens (see standard.ts).
const TOKENS_SCHEMA = {
  type: "object",
  properties: {
    primary: { type: "string", description: "accent/link color as a hex value" },
    ink: { type: "string", description: "primary text color as a hex value" },
    paper: { type: "string", description: "page background as a hex value" },
    muted: { type: "string", description: "secondary/muted text color as a hex value" },
    line: { type: "string", description: "border/rule color as a hex value" },
    fontFamily: { type: "string", description: "body font stack (CSS font-family value)" },
    headingFontFamily: { type: "string", description: "heading font stack (CSS font-family value)" },
  },
} as const;

export interface BrandKitGenerationResult {
  standard: BrandingStandard;
}

export async function generateBrandingStandard(opts: {
  imageBuffer: Buffer;
  originalFileName: string;
  model?: string;
}): Promise<BrandKitGenerationResult> {
  const runDir = makeRunDir("brandkit");
  const ext = imageExtension(opts.originalFileName);
  const inputName = `brand-input${ext}`;

  try {
    // Save the source image inside the run dir so the agent can Read it by
    // relative name (paths resolve against runDir, its permission root).
    fs.writeFileSync(path.join(runDir, inputName), opts.imageBuffer);

    const turn = await sendTurn({
      systemPrompt: BRAND_KIT_SYSTEM_PROMPT,
      prompt: `Read the image file "${inputName}" in the current directory. Then turn it into a design system by writing exactly two files in the current directory: "design.html" and "design.md", per your instructions. Use relative filenames only. When both files are written, briefly confirm the palette you used.`,
      tools: "Read,Write",
      model: opts.model,
      cwd: runDir,
      timeoutMs: 300_000,
    });

    const htmlPath = path.join(runDir, "design.html");
    const mdPath = path.join(runDir, "design.md");
    if (!fs.existsSync(htmlPath) || !fs.existsSync(mdPath)) {
      throw new Error(
        "Atlas did not produce both design.html and design.md. Please try again with a clearer brand image.",
      );
    }
    const html = fs.readFileSync(htmlPath, "utf-8");
    const md = fs.readFileSync(mdPath, "utf-8");
    if (!html.trim() || !md.trim()) {
      throw new Error("The generated design files came back empty. Please try again.");
    }

    // Pull the compact tokens from the same session.
    let tokens: BrandTokens = {};
    if (turn.sessionId) {
      try {
        const extraction = await extractStructured({
          resumeSessionId: turn.sessionId,
          schema: TOKENS_SCHEMA,
          model: opts.model,
          cwd: runDir,
          timeoutMs: 120_000,
        });
        if (extraction.structuredOutput) tokens = extraction.structuredOutput as BrandTokens;
      } catch {
        // Non-fatal: fall back to DEFAULT_TOKENS via resolveTokens. The
        // design.html/.md are the primary deliverable; tokens are a bonus.
      }
    }

    const id = `brand-${Date.now()}`;
    const htmlFileName = `${id}.html`;
    const mdFileName = `${id}.md`;
    const sourceImageFileName = `${id}-source${ext}`;

    saveText(htmlFileName, html);
    saveText(mdFileName, md);
    saveBinary(sourceImageFileName, opts.imageBuffer);

    // Best-effort: cache real font files for PDF rendering (pdf/styles.ts)
    // so exports can use the brand's actual typeface instead of Helvetica.
    // Never blocks or fails brand kit generation -- resolveBrandFont
    // returns null for anything unresolvable.
    const [bodyFont, headingFont] = await Promise.all([
      resolveBrandFont(tokens.fontFamily, `${id}-body`),
      resolveBrandFont(tokens.headingFontFamily, `${id}-heading`),
    ]);
    if (bodyFont) tokens.bodyFont = bodyFont;
    if (headingFont) tokens.headingFont = headingFont;

    const standard: BrandingStandard = {
      id,
      createdAt: new Date().toISOString(),
      title: opts.originalFileName,
      sourceImageFileName,
      htmlFileName,
      mdFileName,
      tokens,
    };

    return { standard };
  } finally {
    // Best-effort cleanup of the scratch run dir regardless of outcome.
    try {
      fs.rmSync(runDir, { recursive: true, force: true });
    } catch {
      // Leave it for the OS temp cleaner if removal fails.
    }
  }
}
