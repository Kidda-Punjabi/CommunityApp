import Link from "next/link";
import { UserAvatar } from "@/components/profile/user-avatar";
import { attentionItems, loadTutorClassBoard } from "@/lib/tutoring/load-tutor-classes";
import { loadHomeworkReviewBoard } from "@/lib/tutoring/homework-review-board";
import { getDisplayName } from "@/lib/profile/display-name";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

function londonDateLabel(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  })
    .format(now)
    .replace(",", "");
}

export default async function TutorHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { client: admin } = tryCreateServiceRoleClient();
  const [board, homework, profile] = await Promise.all([
    loadTutorClassBoard(admin ?? supabase, user.id),
    loadHomeworkReviewBoard(supabase, user.id),
    loadEditableProfile(supabase, user.id),
  ]);
  const attention = attentionItems(board.active);
  const avatarProfile = profile ?? {
    full_name: null,
    preferred_name: null,
    avatar_url: null,
  };
  const firstName = getDisplayName(avatarProfile) ?? "there";
  const homeworkCount = homework.pendingSubmissions.length;

  return (
    <div className="mx-auto flex w-full max-w-[390px] flex-col gap-4 px-4 py-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">{londonDateLabel()}</p>
          <h1 className="font-heading text-2xl font-bold text-zinc-900">Sat Sri Akal, {firstName}</h1>
        </div>
        <Link
          href="/dashboard/tutor/profile"
          aria-label="Profile"
          className="flex h-11 w-11 items-center justify-center"
        >
          <UserAvatar profile={avatarProfile} size="sm" />
        </Link>
      </header>

      <Link href="/dashboard/tutor/log" className={ui.heroCard}>
        <p className={ui.heroTitle}>Log a lesson</p>
        <p className={ui.heroSubtitle}>Attendance, notes, and the lesson page in one save.</p>
      </Link>

      <Link href="/dashboard/tutor/homework" className={`${ui.cardInteractive} flex min-h-11 items-center justify-between`}>
        <span className="font-semibold text-zinc-900">Review homework</span>
        <span className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-violet-600 px-2 text-sm font-semibold text-white">
          {homeworkCount}
        </span>
      </Link>

      {attention.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Needs attention</h2>
          <ul className="flex flex-col gap-2">
            {attention.map((card) => (
              <li key={card.id}>
                <Link href={card.href} className="flex min-h-11 items-center rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
                  <span className={card.issue.tone === "red" ? "text-red-600" : "text-amber-700"}>
                    {card.issue.label} · {card.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/tutor/classes?filter=group" className={`${ui.cardInteractive} min-h-11`}>
          <p className="font-heading text-2xl font-bold text-zinc-900">{board.groupCount}</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">Group cohorts</p>
          <p className="text-sm text-zinc-500">{board.groupStudentCount} students</p>
        </Link>
        <Link href="/dashboard/tutor/classes?filter=one_to_one" className={`${ui.cardInteractive} min-h-11`}>
          <p className="font-heading text-2xl font-bold text-zinc-900">{board.oneToOneCount}</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">1-1 students</p>
        </Link>
      </div>
    </div>
  );
}
