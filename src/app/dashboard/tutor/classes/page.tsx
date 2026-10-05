import Link from "next/link";
import { TutorClassCardView } from "@/components/tutor/tutor-class-card";
import { loadTutorClassBoard, type TutorClassCard } from "@/lib/tutoring/load-tutor-classes";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

type ClassesPageProps = {
  searchParams: Promise<{ filter?: string; view?: string }>;
};

const filters = [
  { id: "all", label: "All" },
  { id: "group", label: "Group" },
  { id: "one_to_one", label: "1-1" },
  { id: "attention", label: "Needs attention" },
] as const;

function applyFilter(cards: TutorClassCard[], filter: string): TutorClassCard[] {
  if (filter === "group") return cards.filter((card) => card.kind === "group");
  if (filter === "one_to_one") return cards.filter((card) => card.kind === "one_to_one");
  if (filter === "attention") return cards.filter((card) => card.issue.tone !== "green");
  return cards;
}

export default async function TutorClassesPage({ searchParams }: ClassesPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { client: admin } = tryCreateServiceRoleClient();
  const board = await loadTutorClassBoard(admin ?? supabase, user.id);
  const finishedView = params.view === "finished";
  const filter = filters.some((item) => item.id === params.filter) ? params.filter! : "all";
  const cards = finishedView ? board.finished : applyFilter(board.active, filter);

  return (
    <div className="mx-auto flex w-full max-w-[390px] flex-col gap-4 px-4 py-5">
      <h1 className="font-heading text-2xl font-bold text-zinc-900">
        {finishedView ? "Finished classes" : "Classes"}
      </h1>

      {finishedView ? (
        <Link href="/dashboard/tutor/classes" className="inline-flex min-h-11 items-center text-sm font-semibold text-violet-700">
          Back to active classes
        </Link>
      ) : (
        <div className="flex gap-2 overflow-x-auto">
          {filters.map((item) => {
            const active = filter === item.id;
            const href = item.id === "all" ? "/dashboard/tutor/classes" : `/dashboard/tutor/classes?filter=${item.id}`;
            return (
              <Link
                key={item.id}
                href={href}
                className={`inline-flex min-h-11 shrink-0 items-center ${active ? ui.pillActive : ui.pillInactive}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      {cards.length === 0 ? (
        <p className="rounded-3xl bg-white p-5 text-sm text-zinc-500">No classes in this list.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((card) => (
            <li key={`${card.kind}-${card.id}`}>
              <TutorClassCardView card={card} />
            </li>
          ))}
        </ul>
      )}

      {!finishedView ? (
        <Link href="/dashboard/tutor/classes?view=finished" className="inline-flex min-h-11 items-center text-sm font-semibold text-violet-700">
          Finished classes ({board.finished.length})
        </Link>
      ) : null}
    </div>
  );
}
