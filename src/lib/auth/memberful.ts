// Server-only Memberful OAuth (PKCE) helpers. Imports node:crypto, so this
// module must never be imported by a client component — client-safe
// constants live in ./memberfulConfig.
import crypto from "crypto";
import {
  MEMBERFUL_CLIENT_ID,
  REDIRECT_URI,
  memberfulBaseUrl,
} from "./memberfulConfig";

/** A PKCE verifier/challenge pair (S256). */
export interface Pkce {
  verifier: string;
  challenge: string;
}

/**
 * Generate a PKCE code_verifier and its S256 code_challenge. The verifier is
 * kept (in an httpOnly cookie) until the callback; the challenge is sent to
 * Memberful on the authorize redirect.
 */
export function generatePkce(): Pkce {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

/** Build the Memberful authorize URL to redirect the user to. */
export function buildAuthorizeUrl(challenge: string): string {
  const url = new URL(`${memberfulBaseUrl()}/oauth`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", MEMBERFUL_CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
}

/**
 * Exchange an authorization code for an access token using PKCE. Public
 * ("Single-page") client — no client_secret is sent.
 */
export async function exchangeCodeForToken(
  code: string,
  verifier: string,
): Promise<TokenResponse> {
  const res = await fetch(`${memberfulBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: MEMBERFUL_CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Memberful token exchange failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as TokenResponse;
}

/** The signed-in member's email and whether they hold an active subscription. */
export interface MemberCheck {
  email: string;
  active: boolean;
}

/**
 * Fetch the signed-in member and whether ANY of their subscriptions is
 * currently active, via Memberful's member GraphQL endpoint. Returns null if
 * the token maps to no member.
 */
export async function fetchMemberStatus(
  accessToken: string,
): Promise<MemberCheck | null> {
  const query = "{ currentMember { email subscriptions { active } } }";
  const url = `${memberfulBaseUrl()}/api/graphql/member?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Memberful member lookup failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { currentMember?: { email?: string; subscriptions?: { active?: boolean }[] } };
  };
  const member = json.data?.currentMember;
  if (!member?.email) return null;
  const active = Array.isArray(member.subscriptions)
    ? member.subscriptions.some((s) => s.active === true)
    : false;
  return { email: member.email, active };
}
