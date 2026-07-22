import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updateEvent, deleteEvent, EventInput } from "@/lib/googleCalendar";

// Patches an event -- used for both edits and time moves from the panel.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = await getDb();
  try {
    const body = (await req.json()) as Partial<EventInput>;
    if (!body.summary || !body.start || !body.end) {
      return NextResponse.json({ error: "summary, start, and end are required." }, { status: 400 });
    }
    const event = await updateEvent(db.data.settings, req.nextUrl.origin, id, {
      summary: body.summary,
      start: body.start,
      end: body.end,
      allDay: body.allDay,
      location: body.location,
    });
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update the event." },
      { status: 502 },
    );
  }
}

// Removes the event from the primary calendar. Unlike the Gmail trash
// flow, the Calendar API delete is permanent (no undo) -- the panel
// guards it behind a confirm click.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = await getDb();
  try {
    await deleteEvent(db.data.settings, req.nextUrl.origin, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete the event." },
      { status: 502 },
    );
  }
}
