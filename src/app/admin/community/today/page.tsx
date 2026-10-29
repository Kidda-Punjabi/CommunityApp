import { overrideWeek, startSession, startTestSession } from "@/app/admin/community/actions";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  starts_at: string;
  status: string;
  week_number: number;
  week_number_override: number | null;
  community_sessions: { title: string; is_active: boolean } | { title: string; is_active: boolean }[] | null;
  lessons: { title: string | null } | { title: string | null }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

/** Sessions from 3 hours ago to 8 days ahead. */
async function loadWindow(): Promise<Row[]> {
  const now = Date.now();
  const { data } = await createServiceRoleClient()
    .from("community_session_occurrences")
    .select("id, starts_at, status, week_number, week_number_override, community_sessions(title, is_active), lessons:topic_lesson_id(title)")
    .gte("starts_at", new Date(now - 3 * 60 * 60 * 1000).toISOString())
    .lte("starts_at", new Date(now + 8 * 24 * 60 * 60 * 1000).toISOString())
    .neq("status", "cancelled")
    .order("starts_at");
  return (data ?? []) as Row[];
}

export default async function CommunityTodayPage() {
  const rows = await loadWindow();

  const live = rows.filter((row) => row.status === "live");
  const upcoming = rows.filter((row) => row.status === "scheduled" && one(row.community_sessions)?.is_active !== false);
  const next = upcoming[0] ?? null;
  const later = upcoming.slice(1);
  const nextSession = next ? one(next.community_sessions) : null;
  const nextLesson = next ? one(next.lessons) : null;
  const nextWeek = next ? (next.week_number_override ?? next.week_number) : null;

  return (
    <div className="space-y-5 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-zinc-900">Community</h1>
          {nextWeek ? (
            <p className="text-sm text-zinc-500">
              This week is Week {nextWeek}
              {nextLesson?.title ? ` · ${nextLesson.title}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {live.map((row) => {
        const session = one(row.community_sessions);
        const test = session?.is_active === false;
        return (
          <Link
            key={row.id}
            href={`/admin/community/session/${row.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-violet-700 px-6 py-5 text-white"
          >
            <span>
              <span className="block text-xs font-bold uppercase tracking-[0.08em] text-violet-200">
                {test ? "Test session live · staff only" : "Live now"}
              </span>
              <span className="block font-heading text-2xl font-extrabold">
                {session?.title} · Week {row.week_number_override ?? row.week_number}
              </span>
            </span>
            <span className="inline-flex min-h-12 items-center rounded-2xl bg-white px-5 text-base font-extrabold text-violet-800">
              Open live session
            </span>
          </Link>
        );
      })}

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <section className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-500">Next session</p>
          {next ? (
            <>
              <div>
                <p className="font-heading text-3xl font-extrabold text-zinc-900">{nextSession?.title}</p>
                <p className="text-base text-zinc-600">{when(next.starts_at)}</p>
              </div>
              <form
                action={async (formData) => {
                  "use server";
                  await overrideWeek(next.id, Number(formData.get("week")));
                }}
                className="flex flex-wrap items-center gap-2 rounded-2xl bg-zinc-50 px-3 py-2.5"
              >
                <label className="text-sm font-bold text-zinc-700" htmlFor="next-week">
                  Week
                </label>
                <input
                  id="next-week"
                  name="week"
                  type="number"
                  min={1}
                  max={24}
                  defaultValue={nextWeek ?? 1}
                  className="h-10 w-16 rounded-lg border border-zinc-200 px-2 text-[16px]"
                />
                <span className="flex-1 text-sm font-semibold text-zinc-800">{nextLesson?.title ?? ""}</span>
                <button type="submit" className="min-h-10 rounded-lg px-3 text-sm font-bold text-violet-700">
                  Change week
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await startSession(next.id);
                }}
              >
                <button type="submit" className="min-h-14 rounded-2xl bg-violet-600 px-7 text-[17px] font-bold text-white">
                  Start session
                </button>
              </form>
              <p className="text-[13px] text-zinc-500">Start session opens the live session page and creates the check-in code.</p>
            </>
          ) : (
            <p className="text-base text-zinc-600">No sessions in the next 8 days.</p>
          )}
        </section>

        <section className="flex flex-col gap-1 rounded-3xl border border-zinc-200 bg-white p-6">
          <p className="pb-2 text-base font-extrabold">This week</p>
          {later.length === 0 ? <p className="text-sm text-zinc-500">Nothing else scheduled.</p> : null}
          {later.map((row) => {
            const session = one(row.community_sessions);
            return (
              <Link
                key={row.id}
                href={`/admin/community/session/${row.id}`}
                className="flex min-h-14 items-center gap-3 border-b border-zinc-100 last:border-0"
              >
                <span className="flex-1">
                  <span className="block text-[15px] font-bold text-zinc-900">{session?.title}</span>
                  <span className="block text-[13px] text-zinc-500">
                    {when(row.starts_at)} · Week {row.week_number_override ?? row.week_number}
                  </span>
                </span>
                <span className="text-sm font-bold text-violet-700">Open</span>
              </Link>
            );
          })}
        </section>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-zinc-200 bg-white px-6 py-4">
        <div>
          <p className="text-[15px] font-bold text-zinc-900">Test session</p>
          <p className="text-[13px] text-zinc-500">Staff only. Members never see it, and it counts for nothing: no XP, streaks or attendance.</p>
        </div>
        <form
          action={async (formData) => {
            "use server";
            await startTestSession(Number(formData.get("week")));
          }}
          className="flex items-center gap-2"
        >
          <label className="text-sm text-zinc-600" htmlFor="test-week">
            Week
          </label>
          <input
            id="test-week"
            name="week"
            type="number"
            min={1}
            max={24}
            required
            defaultValue={nextWeek ?? 1}
            className="h-11 w-16 rounded-xl border border-zinc-200 px-2 text-[16px]"
          />
          <button type="submit" className="min-h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-violet-700">
            Start a test session
          </button>
        </form>
      </section>
    </div>
  );
}
