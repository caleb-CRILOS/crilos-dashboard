import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { exchangeCodeForTokens, getOAuthClient } from "@/lib/gmail";

// Google redirects here after the user grants (or denies) consent.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${req.nextUrl.origin}/settings?gmailError=${encodeURIComponent(error)}`,
    );
  }
  if (!code) {
    return NextResponse.redirect(
      `${req.nextUrl.origin}/settings?gmailError=${encodeURIComponent("No authorization code returned.")}`,
    );
  }

  const db = await getDb();
  try {
    const oauth2Client = getOAuthClient(db.data.settings, req.nextUrl.origin);
    const { refreshToken } = await exchangeCodeForTokens(oauth2Client, code);
    db.data.settings.gmailRefreshToken = refreshToken;
    await db.write();
    return NextResponse.redirect(`${req.nextUrl.origin}/settings?gmailConnected=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not finish connecting Gmail.";
    return NextResponse.redirect(
      `${req.nextUrl.origin}/settings?gmailError=${encodeURIComponent(message)}`,
    );
  }
}
