// Shared Google OAuth plumbing for every Google API this app talks to
// (Gmail today, Calendar as of this change). Previously this lived inside
// gmail.ts; it was lifted out so Gmail and Calendar share ONE consent
// grant and ONE refresh token instead of connecting separately.
//
// The single grant is stored in Settings under the (legacy-named)
// gmailClientId / gmailClientSecret / gmailRefreshToken fields -- those
// now hold the generic Google OAuth client + unified token, not just
// Gmail's. Kept the names to avoid a db migration; see the note in
// src/lib/types.ts.

import { google } from "googleapis";
import { Settings } from "./types";

// Derived from googleapis' own google.auth.OAuth2 constructor rather than
// imported separately from google-auth-library -- googleapis depends on
// its own nested copy of that package (via googleapis-common), and a
// top-level import resolves to a structurally-incompatible duplicate
// under TypeScript's nominal-ish private-field checking.
export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

// The unified consent this app requests. gmail.modify supersedes
// gmail.readonly (all read ops) and adds label/trash writes for
// mark-as-read and delete -- it does NOT grant send or permanent
// deletion. gmail.compose covers draft creation. calendar.events grants
// read AND write on the user's events (list/insert/patch/delete) without
// the broader calendar-management (ACL/settings) access full `calendar`
// would add.
//
// Widening this list means anyone already connected under the old
// Gmail-only grant must reconnect (Reconnect Google in Settings) before
// the newly-added scopes work -- their existing refresh token won't carry
// them. prompt=consent (below) forces a fresh refresh token on reconnect.
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.events",
];

// Kept at the Gmail-era path so existing Google Cloud OAuth clients don't
// need a new redirect URI registered -- the route folder is still named
// `email` for the same reason (see src/app/api/email/oauth/).
export function redirectUri(origin: string): string {
  return `${origin}/api/email/oauth/callback`;
}

export function getOAuthClient(settings: Settings, origin: string): OAuth2Client {
  if (!settings.gmailClientId || !settings.gmailClientSecret) {
    throw new Error("Google client ID/secret aren't set in Settings yet.");
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
    scope: GOOGLE_SCOPES,
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

// Returns an OAuth2 client already loaded with the stored refresh token,
// ready to hand to google.gmail({ auth }) / google.calendar({ auth }).
// The single source of "am I connected to Google?" -- throws the same
// message every API lib surfaces if the user hasn't connected yet.
export function getAuthedClient(settings: Settings, origin: string): OAuth2Client {
  if (!settings.gmailRefreshToken) {
    throw new Error("Google isn't connected yet -- connect it from Settings first.");
  }
  const oauth2Client = getOAuthClient(settings, origin);
  oauth2Client.setCredentials({ refresh_token: settings.gmailRefreshToken });
  return oauth2Client;
}
