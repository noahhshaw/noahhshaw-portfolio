"use client";

import { useEffect, useState } from "react";
import type { CalendarEvent } from "@/db/schema";

const TYPE_OPTIONS = [
  "family-date",
  "milestone",
  "vaccine",
  "well-visit",
  "school-deadline",
  "custom",
] as const;

export function CalendarSection() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState<(typeof TYPE_OPTIONS)[number]>(
    "family-date"
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "yearly">("yearly");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/baby/calendar");
    const data = await res.json();
    setEvents(data.events ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add() {
    if (!eventDate || !title) {
      setErr("Date and title required");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch("/api/baby/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventDate,
          eventType,
          title,
          description: description || undefined,
          recurrence,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? "add failed");
        return;
      }
      setEventDate("");
      setTitle("");
      setDescription("");
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this event?")) return;
    const res = await fetch(`/api/baby/calendar?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) refresh();
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Personal calendar</h2>
        <span className="text-[10px] text-gray-500">
          Surfaced in upcoming-events on the daily email.
        </span>
      </div>

      <div className="mb-4 rounded border border-gray-100 bg-gray-50 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <select
            value={eventType}
            onChange={(e) =>
              setEventType(e.target.value as (typeof TYPE_OPTIONS)[number])
            }
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g., Mother's Day)"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm sm:col-span-2"
          />
          <select
            value={recurrence}
            onChange={(e) =>
              setRecurrence(e.target.value as "none" | "yearly")
            }
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="none">One-time</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
        <button
          onClick={add}
          disabled={submitting}
          className="mt-2 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add event"}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-gray-500">
          No events yet. Mother&apos;s Day, grandparent birthdays, family
          milestones — all live here.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex items-center justify-between py-2"
            >
              <div className="min-w-0">
                <span className="mr-2 inline-block w-24 text-xs font-medium text-gray-700">
                  {ev.eventDate}
                </span>
                <span className="text-gray-900">{ev.title}</span>
                {ev.description && (
                  <span className="ml-2 text-xs text-gray-500">
                    — {ev.description}
                  </span>
                )}
                <span className="ml-2 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                  {ev.eventType}
                </span>
                {ev.recurrence === "yearly" && (
                  <span className="ml-1 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
                    yearly
                  </span>
                )}
                {ev.source === "aap" && (
                  <span className="ml-1 inline-block rounded bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-700">
                    AAP
                  </span>
                )}
              </div>
              {ev.source !== "aap" && (
                <button
                  onClick={() => remove(ev.id)}
                  className="text-[10px] text-gray-500 hover:text-red-700"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
