// Google Calendar access for the overview's schedule panel. Sibling of
// gmail.ts -- both share the one OAuth grant/refresh token via
// googleAuth.ts. Scope is calendar.events (read + write events on the
// user's calendars), so this module can list, create, move, and delete
// events, but not touch calendar-level settings or sharing/ACLs.

import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { Settings } from "./types";
import { getAuthedClient } from "./googleAuth";

function getCalendarClient(settings: Settings, origin: string): calendar_v3.Calendar {
  return google.calendar({ version: "v3", auth: getAuthedClient(settings, origin) });
}

// Normalized event shape sent to the client. `start`/`end` are whatever
// Google returned: an RFC3339 date-time for timed events, or a
// YYYY-MM-DD date for all-day events (distinguished by `allDay`).
export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  htmlLink?: string;
}

// Input for create/update. `start`/`end` are full RFC3339 UTC strings for
// timed events (the client sends new Date(localValue).toISOString()), or
// YYYY-MM-DD for all-day events. Google treats an all-day event's `end`
// date as exclusive -- the caller is responsible for that convention.
export interface EventInput {
  summary: string;
  start: string;
  end: string;
  allDay?: boolean;
  location?: string;
}

function normalizeEvent(e: calendar_v3.Schema$Event): CalendarEvent {
  const allDay = Boolean(e.start?.date);
  return {
    id: e.id ?? "",
    summary: e.summary ?? "(no title)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    allDay,
    location: e.location ?? undefined,
    htmlLink: e.htmlLink ?? undefined,
  };
}

function toRequestBody(input: EventInput): calendar_v3.Schema$Event {
  const start = input.allDay ? { date: input.start } : { dateTime: input.start };
  const end = input.allDay ? { date: input.end } : { dateTime: input.end };
  return {
    summary: input.summary,
    location: input.location || undefined,
    start,
    end,
  };
}

export async function listEvents(
  settings: Settings,
  origin: string,
  range: { timeMin: string; timeMax: string },
): Promise<CalendarEvent[]> {
  const calendar = getCalendarClient(settings, origin);
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: range.timeMin,
    timeMax: range.timeMax,
    singleEvents: true, // expand recurring events into instances
    orderBy: "startTime", // requires singleEvents: true
    maxResults: 100,
  });
  return (res.data.items ?? []).map(normalizeEvent);
}

export async function createEvent(
  settings: Settings,
  origin: string,
  input: EventInput,
): Promise<CalendarEvent> {
  const calendar = getCalendarClient(settings, origin);
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: toRequestBody(input),
  });
  return normalizeEvent(res.data);
}

export async function updateEvent(
  settings: Settings,
  origin: string,
  eventId: string,
  input: EventInput,
): Promise<CalendarEvent> {
  const calendar = getCalendarClient(settings, origin);
  // patch (not update) so we only send the fields we manage and leave
  // anything else on the event -- attendees, description, etc. -- intact.
  const res = await calendar.events.patch({
    calendarId: "primary",
    eventId,
    requestBody: toRequestBody(input),
  });
  return normalizeEvent(res.data);
}

export async function deleteEvent(
  settings: Settings,
  origin: string,
  eventId: string,
): Promise<void> {
  const calendar = getCalendarClient(settings, origin);
  await calendar.events.delete({ calendarId: "primary", eventId });
}
