// Gmail API access for the email skill. Deliberately independent of
// claude-cli.ts -- that module stays pure text generation (summarizing,
// drafting reply text), this module is the only thing in the app that
// talks to Gmail itself. There is intentionally NO send function
// anywhere in this file -- only list/read/create-draft/trash/mark-read.
// "Draft, never send" is enforced by what's implemented here, not just
// a UI choice.

import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { Settings } from "./types";

// Derived from googleapis' own google.auth.OAuth2 constructor rather than
// imported separately from google-auth-library -- googleapis depends on
// its own nested copy of that package (via googleapis-common), and a
// top-level import resolves to a structurally-incompatible duplicate
// under TypeScript's nominal-ish private-field checking.
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

// gmail.modify supersedes gmail.readonly (all read ops) and adds
// label/trash writes -- needed for mark-as-read and delete. It does NOT
// grant send or permanent deletion. Widening this scope means anyone
// already connected under the old readonly+compose grant must
// reconnect (Reconnect Gmail in Settings) before delete/mark-read will
// work -- their existing refresh token won't carry the new scope.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
];

export function redirectUri(origin: string): string {
  return `${origin}/api/email/oauth/callback`;
}

export function getOAuthClient(settings: Settings, origin: string): OAuth2Client {
  if (!settings.gmailClientId || !settings.gmailClientSecret) {
    throw new Error("Gmail client ID/secret aren't set in Settings yet.");
  }
  return new google.auth.OAuth2(
    settings.gmailClientId,
    settings.gmailClientSecret,
    redirectUri(origin),
  );
}

export function getAuthUrl(oauth2Client: OAuth2Client): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token every time, not just on first-ever consent
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(
  oauth2Client: OAuth2Client,
  code: string,
): Promise<{ refreshToken: string }> {
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token -- revoke this app's access at " +
        "https://myaccount.google.com/permissions and try connecting again " +
        "(Google only issues a refresh token on the first consent, or when prompt=consent is forced).",
    );
  }
  return { refreshToken: tokens.refresh_token };
}

function getGmailClient(settings: Settings, origin: string): gmail_v1.Gmail {
  if (!settings.gmailRefreshToken) {
    throw new Error("Gmail isn't connected yet -- connect it from Settings first.");
  }
  const oauth2Client = getOAuthClient(settings, origin);
  oauth2Client.setCredentials({ refresh_token: settings.gmailRefreshToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

export interface UnreadThreadSummary {
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
}

export async function listUnreadThreads(
  settings: Settings,
  origin: string,
  maxResults = 20,
): Promise<UnreadThreadSummary[]> {
  const gmail = getGmailClient(settings, origin);
  const list = await gmail.users.threads.list({
    userId: "me",
    q: "is:unread in:inbox",
    maxResults,
  });
  const threads = list.data.threads ?? [];

  const summaries: UnreadThreadSummary[] = [];
  for (const t of threads) {
    if (!t.id) continue;
    const thread = await gmail.users.threads.get({
      userId: "me",
      id: t.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject"],
    });
    const lastMessage = thread.data.messages?.[thread.data.messages.length - 1];
    const headers = lastMessage?.payload?.headers ?? [];
    const from = headers.find((h) => h.name === "From")?.value ?? "(unknown sender)";
    const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
    summaries.push({ threadId: t.id, from, subject, snippet: lastMessage?.snippet ?? "" });
  }
  return summaries;
}

export interface ThreadDetail {
  threadId: string;
  subject: string;
  from: string;
  fromEmail: string;
  lastMessageId: string;
  bodyText: string;
}

function decodeBody(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf-8");
  }
  for (const child of part.parts ?? []) {
    const text = decodeBody(child);
    if (text) return text;
  }
  // Fall back to HTML if no plain-text part exists -- strip tags crudely
  // rather than pulling in a full HTML parser for this.
  if (part.mimeType === "text/html" && part.body?.data) {
    const html = Buffer.from(part.body.data, "base64url").toString("utf-8");
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

function extractEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1] : fromHeader.trim();
}

export async function getThread(
  settings: Settings,
  origin: string,
  threadId: string,
): Promise<ThreadDetail> {
  const gmail = getGmailClient(settings, origin);
  const thread = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
  const lastMessage = thread.data.messages?.[thread.data.messages.length - 1];
  if (!lastMessage) throw new Error("Thread has no messages.");

  const headers = lastMessage.payload?.headers ?? [];
  const from = headers.find((h) => h.name === "From")?.value ?? "(unknown sender)";
  const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";

  return {
    threadId,
    subject,
    from,
    fromEmail: extractEmail(from),
    lastMessageId: lastMessage.id ?? "",
    bodyText: decodeBody(lastMessage.payload) || lastMessage.snippet || "",
  };
}

function buildRawReply(opts: {
  to: string;
  subject: string;
  bodyText: string;
  inReplyToMessageId: string;
}): string {
  const subject = opts.subject.startsWith("Re:") ? opts.subject : `Re: ${opts.subject}`;
  const message = [
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${opts.inReplyToMessageId}`,
    `References: ${opts.inReplyToMessageId}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    opts.bodyText,
  ].join("\r\n");
  return Buffer.from(message).toString("base64url");
}

// Creates a Gmail draft reply within the given thread. Never sends --
// this is the only write operation this module performs.
export async function createDraftReply(
  settings: Settings,
  origin: string,
  opts: { threadId: string; to: string; subject: string; bodyText: string; inReplyToMessageId: string },
): Promise<string> {
  const gmail = getGmailClient(settings, origin);
  const raw = buildRawReply(opts);
  const draft = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: { raw, threadId: opts.threadId },
    },
  });
  if (!draft.data.id) throw new Error("Gmail didn't return a draft ID.");
  return draft.data.id;
}

function buildRawMessage(opts: { to: string; subject: string; bodyText: string }): string {
  const message = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    opts.bodyText,
  ].join("\r\n");
  return Buffer.from(message).toString("base64url");
}

// Creates a brand-new standalone Gmail draft (no thread, no In-Reply-To) --
// the compose-from-scratch counterpart to createDraftReply above. Still
// never sends: this is the only other place besides createDraftReply that
// writes to Gmail.
export async function createDraft(
  settings: Settings,
  origin: string,
  opts: { to: string; subject: string; bodyText: string },
): Promise<string> {
  const gmail = getGmailClient(settings, origin);
  const raw = buildRawMessage(opts);
  const draft = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });
  if (!draft.data.id) throw new Error("Gmail didn't return a draft ID.");
  return draft.data.id;
}

// Removes the UNREAD label from every message in the thread. Requires
// gmail.modify.
export async function markThreadRead(
  settings: Settings,
  origin: string,
  threadId: string,
): Promise<void> {
  const gmail = getGmailClient(settings, origin);
  await gmail.users.threads.modify({
    userId: "me",
    id: threadId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}

// Moves the thread to Gmail's Trash (same as the trash icon in Gmail's
// own UI) -- reversible for 30 days, not a permanent delete. Requires
// gmail.modify.
export async function trashThread(
  settings: Settings,
  origin: string,
  threadId: string,
): Promise<void> {
  const gmail = getGmailClient(settings, origin);
  await gmail.users.threads.trash({ userId: "me", id: threadId });
}
