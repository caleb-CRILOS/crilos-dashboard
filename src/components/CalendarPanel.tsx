"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  addHours,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  setMinutes,
  setSeconds,
  startOfDay,
  startOfWeek,
} from "date-fns";
import {
  AlertCircle,
  CalendarDays,
  Check,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

// Mirror of the CalendarEvent shape returned by /api/calendar/events
// (src/lib/googleCalendar.ts). start/end are an RFC3339 date-time for
// timed events or a YYYY-MM-DD date for all-day events (allDay tells them
// apart).
interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  htmlLink?: string;
}

interface EventFormValues {
  summary: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
}

type EventInput = {
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
};

// True when the event overlaps the given calendar day. One formula covers
// both timed and all-day events: Google gives all-day events an EXCLUSIVE
// end date, and `end > dayStart` handles that boundary correctly.
function occursOn(e: CalendarEvent, day: Date): boolean {
  if (!e.start || !e.end) return false;
  const s = parseISO(e.start);
  const en = parseISO(e.end);
  return s <= endOfDay(day) && en > startOfDay(day);
}

function timeLabel(e: CalendarEvent): string {
  if (e.allDay) return "All day";
  const s = parseISO(e.start);
  const en = parseISO(e.end);
  return `${format(s, "h:mm a")} – ${format(en, "h:mm a")}`;
}

function eventToValues(e: CalendarEvent): EventFormValues {
  const s = parseISO(e.start);
  if (e.allDay) {
    return {
      summary: e.summary === "(no title)" ? "" : e.summary,
      date: format(s, "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "10:00",
      allDay: true,
      location: e.location ?? "",
    };
  }
  const en = parseISO(e.end);
  return {
    summary: e.summary === "(no title)" ? "" : e.summary,
    date: format(s, "yyyy-MM-dd"),
    startTime: format(s, "HH:mm"),
    endTime: format(en, "HH:mm"),
    allDay: false,
    location: e.location ?? "",
  };
}

// Turn form fields into the API's EventInput, or return a validation
// message. Timed events go out as UTC (toISOString) so Google stores the
// correct instant regardless of the browser's timezone; all-day events go
// out as bare dates with an exclusive +1-day end, per Google's convention.
function valuesToInput(v: EventFormValues): EventInput | { error: string } {
  const summary = v.summary.trim();
  if (!summary) return { error: "Give the event a title." };
  if (!v.date) return { error: "Pick a date." };
  const location = v.location.trim() || undefined;
  if (v.allDay) {
    const end = format(addDays(parseISO(v.date), 1), "yyyy-MM-dd");
    return { summary, start: v.date, end, allDay: true, location };
  }
  const start = new Date(`${v.date}T${v.startTime}`);
  const end = new Date(`${v.date}T${v.endTime}`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { error: "Enter a valid start and end time." };
  if (end <= start) return { error: "End time must be after the start time." };
  return { summary, start: start.toISOString(), end: end.toISOString(), allDay: false, location };
}

export default function CalendarPanel() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Compute the week window once per mount so it stays stable across
  // renders (a fresh new Date() each render would loop the load effect).
  const now = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(now, { weekStartsOn: 1 }), [now]);
  const weekEnd = useMemo(() => endOfWeek(now, { weekStartsOn: 1 }), [now]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/calendar/events?timeMin=${encodeURIComponent(weekStart.toISOString())}&timeMax=${encodeURIComponent(weekEnd.toISOString())}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load your calendar.");
        return;
      }
      setEvents(data.events ?? []);
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const todayEvents = useMemo(
    () =>
      events
        .filter((e) => occursOn(e, now))
        .sort((a, b) => +parseISO(a.start) - +parseISO(b.start)),
    [events, now],
  );

  // The event currently in progress, if any — emphasized as "Now".
  const ongoingId = useMemo(() => {
    const hit = todayEvents.find(
      (e) => !e.allDay && parseISO(e.start) <= now && parseISO(e.end) > now,
    );
    return hit?.id ?? null;
  }, [todayEvents, now]);

  async function createEvent(input: EventInput) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create the event.");
        return;
      }
      setAdding(false);
      await load();
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string, input: EventInput) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update the event.");
        return;
      }
      setEditingId(null);
      await load();
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/events/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete the event.");
        return;
      }
      setConfirmingDeleteId(null);
      setEditingId((cur) => (cur === id ? null : cur));
      await load();
    } catch {
      setError("Request failed — is the dev server running?");
    } finally {
      setBusyId(null);
    }
  }

  const defaultValues: EventFormValues = useMemo(() => {
    const base = setSeconds(setMinutes(addHours(now, 1), 0), 0);
    return {
      summary: "",
      date: format(now, "yyyy-MM-dd"),
      startTime: format(base, "HH:mm"),
      endTime: format(addHours(base, 1), "HH:mm"),
      allDay: false,
      location: "",
    };
  }, [now]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-paper-dim">
          {loading
            ? "Loading your calendar…"
            : `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d")} · ${events.length} event${events.length === 1 ? "" : "s"} this week`}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => {
              setAdding((v) => !v);
              setEditingId(null);
            }}
            className="label-mono flex items-center gap-1.5 btn-accent px-3 py-1.5 text-[12px]"
          >
            <Plus size={14} />
            Event
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="label-mono flex items-center gap-1.5 rounded-sm border border-line-strong px-3 py-1.5 text-[12px] text-paper-dim hover:border-electric hover:text-paper disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 border-l-[3px] border-gold bg-ink-raised px-4 py-3 text-sm text-gold">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            {error}
            {error.includes("Settings") && (
              <>
                {" "}
                <a href="/settings" className="underline">
                  Go to Settings
                </a>
              </>
            )}
          </span>
        </div>
      )}

      {adding && (
        <div className="mb-4">
          <EventForm
            title="New event"
            initial={defaultValues}
            saving={saving}
            onCancel={() => setAdding(false)}
            onSubmit={(input) => createEvent(input)}
          />
        </div>
      )}

      {/* Today */}
      <div className="hud-panel stack overflow-hidden">
        <div className="label-mono flex items-center gap-2 border-b border-line bg-paper px-4 py-2.5 text-[11px] text-ink">
          <CalendarDays size={13} />
          TODAY · {format(now, "EEE, MMM d")}
        </div>
        <div className="bg-ink">
          {todayEvents.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-paper-faint">
              Nothing on the calendar today.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {todayEvents.map((e) => {
                const isEditing = editingId === e.id;
                const isOngoing = ongoingId === e.id;
                return (
                  <li key={e.id} className="px-4 py-3">
                    {isEditing ? (
                      <EventForm
                        title="Edit event"
                        initial={eventToValues(e)}
                        saving={saving}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(input) => saveEdit(e.id, input)}
                      />
                    ) : (
                      <div
                        className={`flex items-start justify-between gap-3 border-l-2 pl-3 ${
                          isOngoing ? "border-clay" : "border-line-strong"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-paper">
                              {e.summary}
                            </span>
                            {isOngoing && (
                              <span className="label-mono shrink-0 bg-clay px-1.5 py-0.5 text-[9px] text-signal-fg">
                                NOW
                              </span>
                            )}
                          </div>
                          <div className="label-mono mt-0.5 text-[11px] text-paper-faint">
                            {timeLabel(e)}
                          </div>
                          {e.location && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-paper-dim">
                              <MapPin size={12} className="shrink-0" />
                              <span className="truncate">{e.location}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingId(e.id);
                              setAdding(false);
                              setConfirmingDeleteId(null);
                            }}
                            title="Edit"
                            className="rounded-sm border border-line-strong px-2 py-1.5 text-paper-dim hover:border-electric hover:text-paper"
                          >
                            <Pencil size={13} />
                          </button>
                          {confirmingDeleteId === e.id ? (
                            <button
                              onClick={() => removeEvent(e.id)}
                              disabled={busyId === e.id}
                              className="label-mono rounded-sm border border-gold px-2 py-1.5 text-[11px] text-gold hover:bg-gold/10 disabled:opacity-50"
                            >
                              {busyId === e.id ? "…" : "Confirm?"}
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmingDeleteId(e.id)}
                              title="Delete"
                              className="rounded-sm border border-line-strong px-2 py-1.5 text-paper-dim hover:border-gold hover:text-gold"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* This week */}
      <div className="mt-4">
        <div className="label-mono mb-2 text-[11px] text-paper-faint">THIS WEEK</div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[680px] grid-cols-7 gap-2">
            {days.map((day) => {
              const dayEvents = events
                .filter((e) => occursOn(e, day))
                .sort((a, b) => +parseISO(a.start) - +parseISO(b.start));
              const isToday = isSameDay(day, now);
              return (
                <div
                  key={day.toISOString()}
                  className={`hud-panel stack min-h-[120px] p-2 ${
                    isToday ? "border-clay" : ""
                  }`}
                >
                  <div
                    className={`label-mono mb-1.5 text-[10px] ${
                      isToday ? "text-clay" : "text-paper-faint"
                    }`}
                  >
                    {format(day, "EEE")} {format(day, "d")}
                  </div>
                  <div className="flex flex-col gap-1">
                    {dayEvents.length === 0 ? (
                      <span className="text-[11px] text-paper-faint/50">—</span>
                    ) : (
                      dayEvents.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => {
                            setEditingId(e.id);
                            setAdding(false);
                            setConfirmingDeleteId(null);
                          }}
                          title={`${e.summary} · ${timeLabel(e)}`}
                          className="border-l-2 border-electric bg-ink-raised px-1.5 py-1 text-left hover:bg-paper/5"
                        >
                          <span className="label-mono block text-[9px] text-paper-faint">
                            {e.allDay ? "All day" : format(parseISO(e.start), "h:mm a")}
                          </span>
                          <span className="line-clamp-2 text-[11px] text-paper">{e.summary}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Editing an event that isn't in today's list (picked from the week
          strip) — surface the form here so it's always reachable. */}
      {editingId && !todayEvents.some((e) => e.id === editingId) && (
        <div className="mt-4">
          {(() => {
            const e = events.find((ev) => ev.id === editingId);
            if (!e) return null;
            return (
              <EventForm
                title={`Edit · ${format(parseISO(e.start), "EEE, MMM d")}`}
                initial={eventToValues(e)}
                saving={saving}
                onCancel={() => setEditingId(null)}
                onSubmit={(input) => saveEdit(e.id, input)}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}

function EventForm({
  title,
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  title: string;
  initial: EventFormValues;
  saving: boolean;
  onSubmit: (input: EventInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<EventFormValues>(initial);
  const [formError, setFormError] = useState<string | null>(null);

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function submit() {
    const result = valuesToInput(values);
    if ("error" in result) {
      setFormError(result.error);
      return;
    }
    setFormError(null);
    onSubmit(result);
  }

  return (
    <div className="hud-panel stack space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="label-mono text-[11px] text-paper-faint">{title}</span>
        <button onClick={onCancel} className="text-paper-faint hover:text-paper" title="Cancel">
          <X size={15} />
        </button>
      </div>

      <div>
        <label className="label-mono mb-1 block text-[11px] text-paper-faint">Title</label>
        <input
          value={values.summary}
          onChange={(e) => set("summary", e.target.value)}
          placeholder="e.g. Discovery call — Jane at Acme"
          className="w-full field"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[8rem] flex-1">
          <label className="label-mono mb-1 block text-[11px] text-paper-faint">Date</label>
          <input
            type="date"
            value={values.date}
            onChange={(e) => set("date", e.target.value)}
            className="w-full field"
          />
        </div>
        {!values.allDay && (
          <>
            <div className="min-w-[6rem] flex-1">
              <label className="label-mono mb-1 block text-[11px] text-paper-faint">Start</label>
              <input
                type="time"
                value={values.startTime}
                onChange={(e) => set("startTime", e.target.value)}
                className="w-full field"
              />
            </div>
            <div className="min-w-[6rem] flex-1">
              <label className="label-mono mb-1 block text-[11px] text-paper-faint">End</label>
              <input
                type="time"
                value={values.endTime}
                onChange={(e) => set("endTime", e.target.value)}
                className="w-full field"
              />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="allDay"
          type="checkbox"
          checked={values.allDay}
          onChange={(e) => set("allDay", e.target.checked)}
          className="h-3.5 w-3.5 accent-clay"
        />
        <label htmlFor="allDay" className="label-mono text-[11px] text-paper-dim">
          All day
        </label>
      </div>

      <div>
        <label className="label-mono mb-1 block text-[11px] text-paper-faint">
          Location <span className="text-paper-faint/60">(optional)</span>
        </label>
        <input
          value={values.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="Zoom, address, …"
          className="w-full field"
        />
      </div>

      {formError && <p className="text-xs text-gold">{formError}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="label-mono rounded-sm border border-line-strong px-3 py-1.5 text-[12px] text-paper-dim hover:border-paper hover:text-paper"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="label-mono flex items-center gap-1.5 btn-accent px-3 py-1.5 text-[12px] disabled:opacity-50"
        >
          <Check size={14} />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
