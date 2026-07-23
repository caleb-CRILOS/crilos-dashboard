// Server-side text extraction for chat attachments that the Claude Code
// CLI's own Read tool can't parse itself (it supports text/images/PDF/
// Jupyter notebooks, not OOXML) -- see src/lib/claude-cli.ts. Formats
// covered here are read/extracted server-side and inlined directly into the
// turn's prompt instead of going through the scratch-file + Read-tool path.

import mammoth from "mammoth";

// The extracted text becomes part of the `-p` prompt argument passed to
// execFile("claude", ...) in claude-cli.ts. Windows' CreateProcess rejects
// the whole command line (all args combined) past ~32,767 chars with
// ENAMETOOLONG -- confirmed by measurement, not just theory: a real
// system prompt for one populated client profile (--system-prompt, built
// from their full content guide/ICA/voice) alone measured 12,295 chars,
// and other clients' content guides can run longer. Cap the attachment's
// share well under that so a large-but-plausible system prompt doesn't
// tip the total over the edge.
const MAX_INLINE_CHARS = 8_000;

export type ExtractedText =
  | { ok: true; text: string; truncated: boolean }
  | { ok: false; reason: string };

// Formats the server can turn into plain text itself, without relying on
// the Claude CLI's own Read tool.
export function extractsInline(ext: string): boolean {
  return ext === ".txt" || ext === ".md" || ext === ".docx";
}

function clip(raw: string): { text: string; truncated: boolean } {
  const text = raw.trim();
  if (text.length <= MAX_INLINE_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_INLINE_CHARS), truncated: true };
}

export async function extractInlineText(ext: string, buffer: Buffer): Promise<ExtractedText> {
  try {
    if (ext === ".txt" || ext === ".md") {
      const raw = buffer.toString("utf-8");
      if (!raw.trim()) return { ok: false, reason: "the file appears to be empty" };
      return { ok: true, ...clip(raw) };
    }
    if (ext === ".docx") {
      const { value } = await mammoth.extractRawText({ buffer });
      if (!value.trim()) {
        return { ok: false, reason: "no readable text was found (it may be image-only or blank)" };
      }
      return { ok: true, ...clip(value) };
    }
    return { ok: false, reason: "unsupported format" };
  } catch (err) {
    console.error("[upload-text-extraction] failed to extract text:", err);
    return { ok: false, reason: "the file could not be parsed (it may be corrupt or password-protected)" };
  }
}
