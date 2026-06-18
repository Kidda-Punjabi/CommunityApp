"use client";

import { useState } from "react";
import {
  debugGetUserStreak,
  debugSetUserStreakDate,
  type StreakDebugState,
} from "../actions";
import {
  computeStreakPresentation,
  daysBetweenActivityDates,
  getLocalActivityDate,
  mapStreakRowSnapshot,
} from "@/lib/progress/activity-date";

function parseStreakField(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function StreakDebugTab() {
  const [email, setEmail] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [currentStreak, setCurrentStreak] = useState("");
  const [longestStreak, setLongestStreak] = useState("");
  const [state, setState] = useState<StreakDebugState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLookup(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const result = await debugGetUserStreak(email.trim());
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setState(null);
      return;
    }

    if (result.data) {
      setState(result.data);
      setActivityDate(result.data.last_activity_date ?? "");
      setCurrentStreak(String(result.data.current_streak));
      setLongestStreak(String(result.data.longest_streak));
      setMessage("Loaded streak state.");
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const result = await debugSetUserStreakDate({
      email: email.trim(),
      lastActivityDate: activityDate,
      currentStreak: parseStreakField(currentStreak),
      longestStreak: parseStreakField(longestStreak),
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setMessage(result.success ?? "Updated.");
    if (result.data) {
      setState(result.data);
      setActivityDate(result.data.last_activity_date ?? "");
      setCurrentStreak(String(result.data.current_streak));
      setLongestStreak(String(result.data.longest_streak));
    }
  }

  const expectedHome =
    state &&
    computeStreakPresentation(
      mapStreakRowSnapshot({
        current_streak: state.current_streak,
        longest_streak: state.longest_streak,
        last_activity_date: state.last_activity_date,
        redemption_available: state.redemption_available,
        streak_broken_date: state.streak_broken_date,
        streak_before_break: state.streak_before_break,
      }),
      getLocalActivityDate()
    );

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Streak debug</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Set a user&apos;s streak state for testing. Dates are compared to your
          browser&apos;s local today. After saving, click <strong>Load streak</strong>{" "}
          to confirm, then open <strong>Home</strong> to run evaluation.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-500">
          <li>
            <strong>Yesterday</strong> — streak stays active, orange warning on Home
          </li>
          <li>
            <strong>2 days ago</strong> — rescue banner, streak number preserved
          </li>
          <li>
            <strong>3+ days ago</strong> — current streak resets to 0 on Home
          </li>
        </ul>
      </div>

      {(message || error) && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            error
              ? "border border-red-200 bg-red-50 text-red-800"
              : "border border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <form onSubmit={handleLookup} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <div>
          <label htmlFor="streak-email" className="block text-sm font-medium text-zinc-700">
            User email
          </label>
          <input
            id="streak-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            placeholder="member@example.com"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          Load streak
        </button>
      </form>

      {state && (
        <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-amber-700">
            Tip: verify with <strong>Load streak</strong> before visiting Home.
            Home only resets current streak when last activity was 3+ days ago
            (or a rescue window expired).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="last-activity" className="block text-sm font-medium text-zinc-700">
                last_activity_date
              </label>
              <input
                id="last-activity"
                type="date"
                required
                value={activityDate}
                onChange={(event) => setActivityDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="current-streak" className="block text-sm font-medium text-zinc-700">
                current_streak
              </label>
              <input
                id="current-streak"
                type="number"
                min={0}
                value={currentStreak}
                onChange={(event) => setCurrentStreak(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="longest-streak" className="block text-sm font-medium text-zinc-700">
                longest_streak
              </label>
              <input
                id="longest-streak"
                type="number"
                min={0}
                value={longestStreak}
                onChange={(event) => setLongestStreak(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
            </div>
          </div>

          <dl className="grid gap-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-500">Browser today</dt>
              <dd>{getLocalActivityDate()}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Day gap</dt>
              <dd>
                {state.last_activity_date
                  ? daysBetweenActivityDates(
                      state.last_activity_date,
                      getLocalActivityDate()
                    )
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Expected on Home</dt>
              <dd>
                {expectedHome && expectedHome.display_streak > 0
                  ? `${expectedHome.display_streak} day streak${
                      expectedHome.streak_at_risk ? " (at risk)" : ""
                    }${expectedHome.redemption_available ? " (rescue)" : ""}`
                  : "No streak yet"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">redemption_available</dt>
              <dd>{state.redemption_available ? "true" : "false"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">streak_broken_date</dt>
              <dd>{state.streak_broken_date ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">streak_before_break</dt>
              <dd>{state.streak_before_break ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">redeemed_today</dt>
              <dd>{state.redeemed_today ? "true" : "false"}</dd>
            </div>
          </dl>

          {expectedHome?.day_gap === 1 && state.current_streak <= 0 && (
            <p className="text-xs text-red-700">
              current_streak is 0 — Home will show &quot;No streak yet&quot;. Set
              current_streak to 10 and save again.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Save test state
          </button>
        </form>
      )}
    </div>
  );
}
