// Generates the on-brand, readable HTML research document for a Sage
// (Market Research) thread -- the sole Market Research export (the legacy
// react-pdf PDF was removed). Atlas authors a self-contained research.html
// styled by the active branding standard's design.md, so the doc genuinely
// uses the design SYSTEM, not just recolored tokens.
//
// Reuses the Brand Kit generation pattern (src/lib/branding/generate.ts):
// run Atlas in an isolated per-run dir with Read/Write, feed it design.md +
// the research content, and read the written file back off disk (rather than
// round-tripping large HTML through JSON, which risks truncation/escaping).

import fs from "fs";
import path from "path";
import { makeRunDir, sendTurn } from "../claude-cli";
import { ChatMessage, DeliverableMeta, SageSession } from "../types";
import { deliverablePath } from "../pdf/generate";
import { getActiveBranding } from "../branding/standard";

const SYSTEM_PROMPT = `You are Atlas, a documents and design partner for a coach or consultant.
You turn a market-research conversation into a single, polished, READABLE
research document as a self-contained HTML file.

This is an information-rich report, NOT abstract art and NOT a raw chat log:
- Synthesize the research into clear prose and structure -- do not paste the
  back-and-forth verbatim.
- Preserve the substance: specific findings, named competitors, data points,
  and any sources/citations mentioned. Do not invent facts that weren't in
  the conversation.
- Structure it: a title, a short meta line with the business name, topic,
  and date, an executive summary, then well-labeled sections of key
  findings, and a sources/references list at the end when sources were
  cited. The business name must appear on its own -- never labeled with
  the word "Client" or similar (no "Client:", "For:", etc.).

Styling: match the provided brand design system EXACTLY -- its palette,
typography, spacing, and overall visual language. All CSS must be inline in a
single <style> tag; the file must be fully self-contained (no external fonts,
scripts, or images). It should look finished and open correctly on its own.`;

function transcript(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === "assistant" ? "Sage (researcher)" : "User"}: ${m.content}`)
    .join("\n\n");
}

export async function generateSageBrandedDoc(
  session: SageSession,
  model?: string,
): Promise<DeliverableMeta> {
  const { designMd, tokens } = getActiveBranding();
  const runDir = makeRunDir("sage-doc");

  try {
    // Give Atlas the brand design system as a file it can Read. When no
    // standard is set, fall back to a compact token summary so the doc still
    // renders cleanly (default styling) rather than hard-blocking.
    let brandInstruction: string;
    if (designMd) {
      fs.writeFileSync(path.join(runDir, "design.md"), designMd, "utf-8");
      brandInstruction = `First, Read the file "design.md" in the current directory -- it is the brand design system this document must follow.`;
    } else {
      brandInstruction = `No brand design system is set, so use this clean, minimal default palette: text ${tokens.ink}, background ${tokens.paper}, accent ${tokens.primary}, muted ${tokens.muted}, borders ${tokens.line}, body font "${tokens.fontFamily}", heading font "${tokens.headingFontFamily}".`;
    }

    const now = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const prompt = `${brandInstruction}

Then write a single file "research.html" in the current directory: a readable, on-brand research document synthesizing the market-research conversation below. Use relative filenames only.

Document metadata:
- Topic: ${session.topic}
- Business name (display as-is, on its own -- do NOT prefix it with "Client:" or any similar label): ${session.clientLabel}
- Date: ${now}

Research conversation to synthesize:
---
${transcript(session.messages)}
---

When research.html is written, briefly confirm what you produced.`;

    await sendTurn({
      systemPrompt: SYSTEM_PROMPT,
      prompt,
      tools: "Read,Write",
      model,
      cwd: runDir,
      timeoutMs: 300_000,
    });

    const htmlPath = path.join(runDir, "research.html");
    if (!fs.existsSync(htmlPath)) {
      throw new Error(
        "Atlas did not produce research.html. Please try exporting the branded doc again.",
      );
    }
    const html = fs.readFileSync(htmlPath, "utf-8");
    if (!html.trim()) {
      throw new Error("The generated research document came back empty. Please try again.");
    }

    const fileName = `${session.id}-branded.html`;
    const outPath = deliverablePath(fileName);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf-8");

    return {
      fileName,
      title: `${session.topic} — Branded Report`,
      generatedAt: new Date().toISOString(),
    };
  } finally {
    try {
      fs.rmSync(runDir, { recursive: true, force: true });
    } catch {
      // Leave it for the OS temp cleaner if removal fails.
    }
  }
}
