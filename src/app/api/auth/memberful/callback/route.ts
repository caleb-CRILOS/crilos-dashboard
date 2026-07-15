import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { exchangeCodeForToken, fetchMemberStatus } from "@/lib/auth/memberful";

// GET /api/auth/memberful/callback?code=...
// Memberful redirects here after the user authorizes. We exchange the code
// (with the PKCE verifier from the cookie, no client secret), confirm the
// member holds an ACTIVE subscription, and on success record the session in
// db.json. Any failure re-gates the user with a reason in the query string.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const verifier = req.cookies.get("mf_pkce_verifier")?.value;

  // Redirect home with a reason, always clearing the one-shot verifier cookie.
  const back = (reason?: string) => {
    const res = NextResponse.redirect(
      new URL(reason ? `/?auth=${reason}` : "/", req.url),
    );
    res.cookies.delete("mf_pkce_verifier");
    return res;
  };

  if (!code || !verifier) {
    return back("error");
  }

  try {
    const token = await exchangeCodeForToken(code, verifier);
    const member = await fetchMemberStatus(token.access_token);

    if (!member || !member.active) {
      return back("denied");
    }

    const db = await getDb();
    db.data.settings.memberAuth = {
      email: member.email,
      verifiedAt: new Date().toISOString(),
    };
    await db.write();

    return back(); // straight to the unlocked dashboard
  } catch (err) {
    console.error("Memberful auth callback failed:", err);
    return back("error");
  }
}
