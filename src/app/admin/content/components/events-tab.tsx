"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createEvent,
  deleteEvent,
  updateEvent,
  type ActionResult,
} from "../actions";
import type { AdminData } from "../types";
import { formatRecurrenceLabel, recurrenceOptions } from "@/lib/events/recurrence";
import {
  FormMessage,
  SectionCard,
  buttonClass,
  dangerButtonClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "./ui";

const initialState: ActionResult = {};

const tierOptions = [
  { value: "", label: "All members (no course required)" },
  { value: "foundational", label: "Foundational Course" },
  { value: "beginners", label: "Beginner Course" },
  { value: "community", label: "Community Course" },
];

function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateInputValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function RecurrenceFields({
  defaultFreq = "",
  defaultUntil = "",
}: {
  defaultFreq?: string;
  defaultUntil?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className={labelClass}>Repeats</label>
        <select name="recurrence_freq" defaultValue={defaultFreq} className={inputClass}>
          {recurrenceOptions.map((option) => (
            <option key={option.value || "none"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Repeat until (optional)</label>
        <input
          name="recurrence_until"
          type="date"
          defaultValue={defaultUntil}
          className={inputClass}
        />
      </div>
    </div>
  );
}

export function EventsTab({ data }: { data: AdminData }) {
  const [createState, createAction, createPending] = useActionState(
    createEvent,
    initialState
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-6">
      <SectionCard title="Add event">
        <form action={createAction} className="space-y-4">
          <div>
            <label className={labelClass}>Title</label>
            <input name="title" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea name="description" rows={3} className={inputClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Starts at</label>
              <input name="starts_at" type="datetime-local" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Ends at (optional)</label>
              <input name="ends_at" type="datetime-local" className={inputClass} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Location</label>
              <input name="location" placeholder="Zoom, London, etc." className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Display order</label>
              <input
                name="display_order"
                type="number"
                min={0}
                defaultValue={0}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Meeting URL (Zoom, etc.)</label>
              <input name="meeting_url" type="url" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>External link (optional)</label>
              <input name="external_url" type="url" className={inputClass} />
            </div>
          </div>
          <RecurrenceFields />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Required course</label>
              <select name="required_tier" className={inputClass} defaultValue="community">
                {tierOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input name="is_free" type="checkbox" value="true" className="rounded" />
                Open to all logged-in members
              </label>
            </div>
          </div>
          <FormMessage state={createState} />
          <button type="submit" disabled={createPending} className={buttonClass}>
            {createPending ? "Saving…" : "Add event"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Events (${data.events.length})`}>
        {data.events.length === 0 ? (
          <p className="text-sm text-zinc-500">No events yet.</p>
        ) : (
          <div className="space-y-4">
            {data.events.map((event) =>
              editingId === event.id ? (
                <EventEditForm
                  key={event.id}
                  event={event}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null);
                    router.refresh();
                  }}
                />
              ) : (
                <div
                  key={event.id}
                  className="rounded-xl border border-zinc-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-900">{event.title}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {new Date(event.starts_at).toLocaleString("en-GB")}
                      </p>
                      {formatRecurrenceLabel(
                        event.recurrence_freq as "weekly" | "biweekly" | "monthly" | null,
                        event.recurrence_until
                      ) && (
                        <p className="mt-1 text-xs font-medium text-violet-600">
                          {formatRecurrenceLabel(
                            event.recurrence_freq as "weekly" | "biweekly" | "monthly" | null,
                            event.recurrence_until
                          )}
                        </p>
                      )}
                      {event.location && (
                        <p className="mt-1 text-sm text-zinc-600">{event.location}</p>
                      )}
                      <p className="mt-2 text-xs text-zinc-400">
                        {event.is_free
                          ? "Open to all members"
                          : event.required_tier
                            ? `Requires ${event.required_tier}`
                            : "All members"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(event.id)}
                        className={secondaryButtonClass}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={dangerButtonClass}
                        onClick={async () => {
                          if (!confirm("Delete this event?")) return;
                          await deleteEvent(event.id);
                          router.refresh();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function EventEditForm({
  event,
  onCancel,
  onSaved,
}: {
  event: AdminData["events"][0];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateEvent, initialState);

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <form action={action} className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
      <input type="hidden" name="id" value={event.id} />
      <div>
        <label className={labelClass}>Title</label>
        <input name="title" required defaultValue={event.title} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={event.description ?? ""}
          className={inputClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Starts at</label>
          <input
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={toDatetimeLocalValue(event.starts_at)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Ends at</label>
          <input
            name="ends_at"
            type="datetime-local"
            defaultValue={event.ends_at ? toDatetimeLocalValue(event.ends_at) : ""}
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Location</label>
          <input
            name="location"
            defaultValue={event.location ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Meeting URL</label>
          <input
            name="meeting_url"
            type="url"
            defaultValue={event.meeting_url ?? ""}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>External link</label>
        <input
          name="external_url"
          type="url"
          defaultValue={event.external_url ?? ""}
          className={inputClass}
        />
      </div>
      <RecurrenceFields
        defaultFreq={event.recurrence_freq ?? ""}
        defaultUntil={toDateInputValue(event.recurrence_until)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Required course</label>
          <select
            name="required_tier"
            defaultValue={event.required_tier ?? ""}
            className={inputClass}
          >
            {tierOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              name="is_free"
              type="checkbox"
              value="true"
              defaultChecked={event.is_free}
              className="rounded"
            />
            Open to all logged-in members
          </label>
        </div>
      </div>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}
