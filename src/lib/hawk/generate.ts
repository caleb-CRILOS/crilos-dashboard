// Multi-format deliverable generation for Sales Outreach (Hawk). Renders
// the same session.asset.finalText into whichever file format the client
// asked for -- word/pdf/powerpoint/email-html -- and saves it under the
// same data/deliverables/ dir every other tool's generated files share
// (see src/lib/pdf/generate.ts). Draft content itself stays format-
// agnostic; each builder below just mechanically adapts the same
// paragraph list rather than Hawk writing differently per format.

import fs from "fs";
import path from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import PptxGenJS from "pptxgenjs";
import { DeliverableMeta, HawkSession } from "../types";
import { deliverablePath } from "../pdf/generate";
import HawkAssetPdf from "../pdf/HawkAssetPdf";
import { cleanText } from "../pdf/markdown";
import { getActiveTokens } from "../branding/standard";
import { customFontName, hex } from "../branding/fontName";
import { businessLabel } from "../pdf/documentIdentity";

const EXTENSION_BY_FORMAT: Record<string, string> = {
  word: "docx",
  pdf: "pdf",
  powerpoint: "pptx",
  "email-html": "html",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  html: "text/html",
};

export function mimeTypeForFileName(fileName: string): string {
  const ext = fileName.split(".").pop() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

function paragraphs(text?: string): string[] {
  return cleanText(text)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function buildPdfBuffer(session: HawkSession): Promise<Buffer> {
  const doc = HawkAssetPdf({ asset: session.asset, clientLabel: session.clientLabel });
  return renderToBuffer(doc);
}

async function buildWordBuffer(session: HawkSession): Promise<Buffer> {
  const { asset, clientLabel } = session;
  const t = getActiveTokens();
  const bodyFont = customFontName(t.fontFamily);
  const headingFont = customFontName(t.headingFontFamily) ?? bodyFont;

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [
              new TextRun({
                text: asset.assetType || "Sales Outreach Asset",
                bold: true,
                color: hex(t.primary),
                font: headingFont ?? undefined,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${asset.prospectLabel || "Prospect n/a"} — ${clientLabel}`,
                italics: true,
                color: hex(t.muted),
                font: bodyFont ?? undefined,
              }),
            ],
          }),
          ...paragraphs(asset.finalText).map(
            (text) =>
              new Paragraph({
                children: [new TextRun({ text, color: hex(t.ink), font: bodyFont ?? undefined })],
                spacing: { after: 200 },
              }),
          ),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

// Naive character-budget chunking -- no content-aware section detection,
// just enough to keep slides from overflowing. Good enough for a v1;
// smarter slide-splitting can layer on once the plumbing works end-to-end.
const SLIDE_CHAR_BUDGET = 500;

function chunkForSlides(paras: string[]): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const para of paras) {
    if (current && current.length + para.length > SLIDE_CHAR_BUDGET) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function buildPowerpointBuffer(session: HawkSession): Promise<Buffer> {
  const { asset, clientLabel } = session;
  const t = getActiveTokens();
  const bodyFont = customFontName(t.fontFamily) ?? undefined;
  const headingFont = customFontName(t.headingFontFamily) ?? bodyFont;

  const pptx = new PptxGenJS();

  const title = pptx.addSlide();
  title.addText(asset.assetType || "Sales Outreach Asset", {
    x: 0.5,
    y: 1.5,
    w: 9,
    fontSize: 28,
    bold: true,
    color: hex(t.primary),
    fontFace: headingFont,
  });
  title.addText(`${asset.prospectLabel || "Prospect n/a"} — ${clientLabel}`, {
    x: 0.5,
    y: 2.3,
    w: 9,
    fontSize: 14,
    color: hex(t.muted),
    fontFace: bodyFont,
  });
  title.addText(new Date().toLocaleDateString(), {
    x: 0.5,
    y: 2.8,
    w: 9,
    fontSize: 11,
    color: hex(t.muted),
    fontFace: bodyFont,
  });

  for (const chunk of chunkForSlides(paragraphs(asset.finalText))) {
    const slide = pptx.addSlide();
    slide.addText(chunk, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 6,
      fontSize: 14,
      valign: "top",
      color: hex(t.ink),
      fontFace: bodyFont,
    });
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Buffer;
}

function buildEmailHtml(session: HawkSession): string {
  const { asset, clientLabel } = session;
  // Style to the active branding standard when one is set; falls back to the
  // original CRILOS defaults (DEFAULT_TOKENS) when there's no standard.
  const t = getActiveTokens();
  const pageBg = shade(t.paper);
  const body = paragraphs(asset.finalText)
    .map((p) => `<p style="margin:0 0 16px;">${escapeHtml(p)}</p>`)
    .join("\n");
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:${pageBg};font-family:${t.fontFamily};color:${t.ink};">
    <div style="max-width:600px;margin:0 auto;background:${t.paper};padding:32px;border:1px solid ${t.line};">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${t.primary};font-family:${t.headingFontFamily};margin-bottom:8px;">
        ${escapeHtml(businessLabel(clientLabel))}
      </div>
      <h1 style="font-size:20px;font-family:${t.headingFontFamily};margin:0 0 4px;">${escapeHtml(asset.assetType || "Sales Outreach Asset")}</h1>
      <div style="font-size:12px;color:${t.muted};margin-bottom:20px;">
        ${escapeHtml(asset.prospectLabel || "Prospect n/a")} — ${escapeHtml(clientLabel)}
      </div>
      ${body}
    </div>
  </body>
</html>`;
}

// The email uses a slightly darker tone than the card background for the
// page behind it (previously the fixed #f5f5f5 vs #ffffff pairing). For a
// #ffffff-ish paper we keep that light gray; otherwise reuse the paper color
// so a dark brand doesn't get an off-white frame.
function shade(paper: string): string {
  return paper.toLowerCase() === "#ffffff" || paper.toLowerCase() === "#fff"
    ? "#f5f5f5"
    : paper;
}

export async function generateHawkDeliverable(session: HawkSession): Promise<DeliverableMeta> {
  const format = session.asset.outputFormat ?? "pdf";
  const ext = EXTENSION_BY_FORMAT[format] ?? "pdf";
  const fileName = `${session.id}-asset.${ext}`;
  const filePath = deliverablePath(fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let buffer: Buffer;
  if (format === "word") {
    buffer = await buildWordBuffer(session);
  } else if (format === "powerpoint") {
    buffer = await buildPowerpointBuffer(session);
  } else if (format === "email-html") {
    buffer = Buffer.from(buildEmailHtml(session), "utf-8");
  } else {
    buffer = await buildPdfBuffer(session);
  }

  fs.writeFileSync(filePath, buffer);

  return {
    fileName,
    title: session.asset.assetType || "Sales Outreach Asset",
    generatedAt: new Date().toISOString(),
  };
}
