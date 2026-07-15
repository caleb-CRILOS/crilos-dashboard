import { NextRequest, NextResponse } from "next/server";
import { MEMBERFUL_CONFIGURED } from "@/lib/auth/memberfulConfig";
import { generatePkce, buildAuthorizeUrl } from "@/lib/auth/memberful";

// GET /api/auth/memberful/start
// Kicks off the Memberful PKCE sign-in: stashes a fresh code_verifier in a
// short-lived httpOnly cookie, then redirects the browser to Memberful's
// authorize page. The matching callback completes the exchange.
export async function GET(req: NextRequest) {
  if (!MEMBERFUL_CONFIGURED) {
    return NextResponse.redirect(new URL("/?auth=unconfigured", req.url));
  }

  const { verifier, challenge } = generatePkce();
  const res = NextResponse.redirect(buildAuthorizeUrl(challenge));
  res.cookies.set("mf_pkce_verifier", verifier, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to complete the round-trip
  });
  return res;
}
