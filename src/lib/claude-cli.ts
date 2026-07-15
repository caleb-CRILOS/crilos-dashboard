// Drives Claude-powered chat features (onboarding, messaging creator) through
// the local Claude Code CLI instead of the Anthropic API directly. If Claude
// Code is logged in via a Claude.ai subscription (not an API key), usage is
// covered by the subscription's plan instead of billed per token -- see
// `claude auth status` to check which auth mode is active.
//
// Runs from a neutral scratch directory, not this project's directory, so
// the spawned agent doesn't inherit this project's own CLAUDE.md, memory, or
// settings -- it should know nothing about the operator running the
// dashboard, only what's in the prompt it's given.

import { execFile } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";

export const SCRATCH_DIR = path.join(os.tmpdir(), "crilos-onboarding-agent");

// Per-run working directory under SCRATCH_DIR, for turns that need to read
// or write files without colliding with other concurrent runs (e.g. the
// Brand Kit generator saves the source image and writes design.html/.md).
// Still inside the SCRATCH_DIR permission root, so relative Read/Write from
// the spawned agent stay allowed.
export function makeRunDir(prefix = "run"): string {
  const dir = path.join(
    SCRATCH_DIR,
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export interface ClaudeCliResult {
  result: string;
  sessionId: string;
  structuredOutput?: Record<string, unknown>;
}

function runClaudeCli(
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {},
): Promise<ClaudeCliResult> {
  const cwd = opts.cwd ?? SCRATCH_DIR;
  fs.mkdirSync(cwd, { recursive: true });
  return new Promise((resolve, reject) => {
    execFile(
      "claude",
      args,
      { cwd, maxBuffer: 20 * 1024 * 1024, timeout: opts.timeoutMs ?? 120_000 },
      (err, stdout, stderr) => {
        if (err && !stdout) {
          reject(
            new Error(
              stderr?.trim() ||
                "Could not reach the Claude Code CLI. Make sure `claude` is installed and you're logged in (`claude auth status`).",
            ),
          );
          return;
        }
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(stdout);
        } catch {
          reject(new Error(`Unexpected output from Claude Code CLI: ${stdout.slice(0, 500)}`));
          return;
        }
        if (parsed.is_error) {
          reject(new Error(String(parsed.result ?? "Claude Code CLI returned an error.")));
          return;
        }
        resolve({
          result: String(parsed.result ?? ""),
          sessionId: String(parsed.session_id ?? ""),
          structuredOutput: parsed.structured_output as Record<string, unknown> | undefined,
        });
      },
    );
  });
}

export function sendTurn(opts: {
  prompt: string;
  systemPrompt: string;
  resumeSessionId?: string;
  model?: string;
  // Comma-separated built-in tool names to enable for this turn (e.g.
  // "WebSearch,WebFetch"). Defaults to "" (no tools) -- the CLI requires the
  // tool to appear in both --tools and --allowedTools for a non-interactive
  // `-p` call to actually use it, not just --tools alone.
  tools?: string;
  // Working directory for this turn. Use makeRunDir() when the agent needs
  // to Read/Write files (relative paths resolve against this dir).
  cwd?: string;
  // Override the default 2-minute timeout for long turns (e.g. generating a
  // full design-system HTML file can exceed 120s).
  timeoutMs?: number;
}): Promise<ClaudeCliResult> {
  const tools = opts.tools ?? "";
  const args = [
    "-p",
    opts.prompt,
    "--output-format",
    "json",
    "--tools",
    tools,
    "--model",
    opts.model || "sonnet",
    "--system-prompt",
    opts.systemPrompt,
    "--setting-sources",
    "",
  ];
  if (tools) args.push("--allowedTools", tools);
  if (opts.resumeSessionId) args.push("--resume", opts.resumeSessionId);
  return runClaudeCli(args, { cwd: opts.cwd, timeoutMs: opts.timeoutMs });
}

const EXTRACTION_SYSTEM_PROMPT = `You are extracting structured data from the conversation you just had,
into the exact JSON schema provided. Use everything discussed in this
conversation. Do not invent facts that were never discussed -- leave a
field as an empty string if it genuinely was never covered.`;

export function extractStructured(opts: {
  resumeSessionId: string;
  schema: object;
  model?: string;
  // Resume in the same run dir the session was created in (see sendTurn.cwd).
  cwd?: string;
  timeoutMs?: number;
}): Promise<ClaudeCliResult> {
  const args = [
    "-p",
    "Output the structured result now.",
    "--output-format",
    "json",
    "--tools",
    "",
    "--model",
    opts.model || "sonnet",
    "--system-prompt",
    EXTRACTION_SYSTEM_PROMPT,
    "--setting-sources",
    "",
    "--resume",
    opts.resumeSessionId,
    "--json-schema",
    JSON.stringify(opts.schema),
  ];
  return runClaudeCli(args, { cwd: opts.cwd, timeoutMs: opts.timeoutMs });
}
