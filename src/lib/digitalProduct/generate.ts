// Deliverable generation for the Digital Product Builder. Renders the
// same session.asset.sections into whichever file format the client asked
// for -- word or pdf only (no powerpoint/email-html; this is a standalone
// document, not a short asset) -- and saves it under the same
// data/deliverables/ dir every other tool's generated files share (see
// src/lib/pdf/generate.ts).

import fs from "fs";
import path from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { DeliverableMeta, DigitalProductSession } from "../types";
import { deliverablePath } from "../pdf/generate";
import DigitalProductPdf from "../pdf/DigitalProductPdf";
import { cleanText } from "../pdf/markdown";
import { getActiveTokens } from "../branding/standard";
import { customFontName, hex } from "../branding/fontName";

const EXTENSION_BY_FORMAT: Record<string, string> = {
  word: "docx",
  pdf: "pdf",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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

async function buildPdfBuffer(session: DigitalProductSession): Promise<Buffer> {
  const doc = DigitalProductPdf({ asset: session.asset, clientLabel: session.clientLabel });
  return renderToBuffer(doc);
}

async function buildWordBuffer(session: DigitalProductSession): Promise<Buffer> {
  const { asset, clientLabel } = session;
  const t = getActiveTokens();
  const bodyFont = customFontName(t.fontFamily);
  const headingFont = customFontName(t.headingFontFamily) ?? bodyFont;

  const sectionParagraphs = (asset.sections ?? []).flatMap((section) => [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({
          text: section.heading,
          bold: true,
          color: hex(t.primary),
          font: headingFont ?? undefined,
        }),
      ],
    }),
    ...paragraphs(section.body).map(
      (text) =>
        new Paragraph({
          children: [new TextRun({ text, color: hex(t.ink), font: bodyFont ?? undefined })],
          spacing: { after: 200 },
        }),
    ),
  ]);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [
              new TextRun({
                text: asset.title || "Digital Product",
                bold: true,
                color: hex(t.primary),
                font: headingFont ?? undefined,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${clientLabel}${asset.productType ? ` — ${asset.productType}` : ""}`,
                italics: true,
                color: hex(t.muted),
                font: bodyFont ?? undefined,
              }),
            ],
          }),
          ...(asset.subtitle
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: asset.subtitle, color: hex(t.ink), font: bodyFont ?? undefined }),
                  ],
                  spacing: { after: 200 },
                }),
              ]
            : []),
          ...sectionParagraphs,
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

export async function generateDigitalProductDeliverable(
  session: DigitalProductSession,
): Promise<DeliverableMeta> {
  const format = session.asset.outputFormat ?? "pdf";
  const ext = EXTENSION_BY_FORMAT[format] ?? "pdf";
  const fileName = `${session.id}-product.${ext}`;
  const filePath = deliverablePath(fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const buffer = format === "word" ? await buildWordBuffer(session) : await buildPdfBuffer(session);
  fs.writeFileSync(filePath, buffer);

  return {
    fileName,
    title: session.asset.title || "Digital Product",
    generatedAt: new Date().toISOString(),
  };
}
