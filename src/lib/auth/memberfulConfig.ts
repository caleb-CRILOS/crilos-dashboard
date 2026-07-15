// Memberful sign-in configuration.
//
// These are PUBLIC values — safe to commit to a public repo. The Client ID
// identifies the app to Memberful but grants nothing on its own; the OAuth
// flow uses PKCE (a per-login code challenge), so there is NO client secret
// to protect here. A forker running their own community swaps in their own
// Memberful subdomain + Client ID below.
//
// Setup (once): in Memberful go Settings → Custom Applications → Add a new
// Custom Application, choose the "Single-page" application type, enable
// "Include OAuth tokens with this application", and set the Redirect URL to
// exactly REDIRECT_URI below. Then paste your account subdomain and the
// generated Client ID here. See the README "Members-only sign-in" section.
//
// This file has NO server-only imports (no node:crypto) so it is safe to
// import from client components. Server-only helpers live in ./memberful.

// Sentinels — while either of these is still the placeholder, sign-in is
// treated as "not configured yet" (the gate shows setup instructions
// instead of a broken login button).
const DOMAIN_PLACEHOLDER = "YOUR_MEMBERFUL_SUBDOMAIN";
const CLIENT_ID_PLACEHOLDER = "YOUR_MEMBERFUL_CLIENT_ID";

/** Your Memberful account subdomain, e.g. "acme" for acme.memberful.com. */
export const MEMBERFUL_DOMAIN = "crilos";

/** The Client ID from your Memberful "Single-page" Custom Application. */
export const MEMBERFUL_CLIENT_ID = "nv6mdVg3XhpN3egvfmSyxUDC";

/**
 * OAuth redirect target. Must match the Redirect URL registered on the
 * Custom Application in Memberful. Because it's registered as a fixed URL,
 * the app must run on port 3000.
 */
export const REDIRECT_URI = "http://localhost:3000/api/auth/memberful/callback";

/**
 * Where a non-member is sent to join. Defaults to your Memberful site's
 * home page; point it at a specific plan/checkout if you prefer.
 */
export const JOIN_URL = `https://${MEMBERFUL_DOMAIN}.memberful.com`;

/** True once real values have been filled in above. */
export const MEMBERFUL_CONFIGURED =
  MEMBERFUL_DOMAIN !== DOMAIN_PLACEHOLDER &&
  MEMBERFUL_CLIENT_ID !== CLIENT_ID_PLACEHOLDER;

/** Base URL of the Memberful account, e.g. https://acme.memberful.com. */
export const memberfulBaseUrl = () => `https://${MEMBERFUL_DOMAIN}.memberful.com`;
