import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthUrl, getOAuthClient } from "@/lib/googleAuth";

// Kicks off the Google consent flow -- the "Connect Google" button on
// Settings links here directly (not fetch+redirect, since this needs a
// real browser navigation to Google's own consent screen). The grant now
// covers Gmail + Calendar in one shot (see GOOGLE_SCOPES in googleAuth).
export async function GET(req: NextRequest) {
  const db = await getDb();
  try {
    const oauth2Client = getOAuthClient(db.data.settings, req.nextUrl.origin);
    const url = getAuthUrl(oauth2Client);
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start Google connection.";
    return NextResponse.redirect(
      `${req.nextUrl.origin}/settings?gmailError=${encodeURIComponent(message)}`,
    );
  }
}
