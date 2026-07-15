import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// POST /api/auth/logout
// Clears the stored Memberful session so the app re-gates on next render.
// Used by the "Sign out" control (switch account / re-verify membership).
export async function POST(req: NextRequest) {
  const db = await getDb();
  db.data.settings.memberAuth = null;
  await db.write();
  // 303 so the browser follows with a GET to the (now gated) home page.
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
