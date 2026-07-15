import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Lightweight client list backing Onboarding's client picker <select>.
// The Clients CRM page/detail view has been removed from the UI; this
// route and the underlying clients collection stay in place, dormant,
// since Onboarding still links sessions to a Client record.
export async function GET() {
  const db = await getDb();
  return NextResponse.json({ clients: db.data.clients });
}
