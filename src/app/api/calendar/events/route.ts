import { NextRequest, NextResponse } from "next/server";
import { startOfWeek, endOfWeek } from "date-fns";
import { getDb } from "@/lib/db";
import { listEvents, createEvent, EventInput } from "@/lib/googleCalendar";

// Lists the current week's events (or an explicit timeMin/timeMax window)
// straight from Google Calendar -- the overview's CalendarPanel splits
// "today" out of the returned week client-side. On the not-connected /
// no-credentials path the underlying lib throws a message containing
// "Settings", which the panel keys off to show a "Go to Settings" link
// (same trick the Inbox uses).
export async function GET(req: NextRequest) {
  const db = await getDb();
  const { searchParams } = req.nextUrl;
  const now = new Date();
  // Week starts Monday to match a business week; the panel derives its 7
  // day columns from the same window it requests here.
  const timeMin =
    searchParams.get("timeMin") ?? startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const timeMax =
    searchParams.get("timeMax") ?? endOfWeek(now, { weekStartsOn: 1 }).toISOString();
  try {
    const events = await listEvents(db.data.settings, req.nextUrl.origin, { timeMin, timeMax });
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach Google Calendar." },
      { status: 502 },
    );
  }
}

// Creates a new event on the primary calendar.
export async function POST(req: NextRequest) {
  const db = await getDb();
  try {
    const body = (await req.json()) as Partial<EventInput>;
    if (!body.summary || !body.start || !body.end) {
      return NextResponse.json({ error: "summary, start, and end are required." }, { status: 400 });
    }
    const event = await createEvent(db.data.settings, req.nextUrl.origin, {
      summary: body.summary,
      start: body.start,
      end: body.end,
      allDay: body.allDay,
      location: body.location,
    });
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create the event." },
      { status: 502 },
    );
  }
}
