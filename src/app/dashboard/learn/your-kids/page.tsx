import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import { BackLink } from "@/components/navigation/back-link";
import { NavLink } from "@/components/ui/nav-link";
import { levelFillVar } from "@/lib/community/levels";
import { requireNoActiveKidProfile } from "@/lib/kids/guards";
import { loadKidProgressSummariesForParent } from "@/lib/kids/load-kid-progress-summary";
import { ui } from "@/lib/ui/styles";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function YourKidsPage() {
  const { user, supabase } = await requireNoActiveKidProfile();
  const rows = await loadKidProgressSummariesForParent(supabase, user.id);

  return (
    <div className={`${ui.page} !py-3`}>
      <BackLink href="/dashboard/learn">Back</BackLink>
      <h1 className="mt-3 font-heading text-2xl font-bold text-[#1F1640]">Your kids</h1>
      <p className="mt-1 text-sm text-[#6B5F8A]">Tap a child to see how they're doing.</p>
      <ul className="mt-4 flex flex-col gap-2">
        {rows.map((row) => {
          const enrolled = Boolean(row.courseId);
          const ring = enrolled
            ? levelFillVar(Math.min(9, Math.max(0, row.currentLevelNumber ?? 0)))
            : undefined;
          const level = row.currentLevelLabel;
          const course = (row.courseName ?? "").replace(/\s*\(Level \d+\)\s*$/i, "");
          const status = !enrolled
            ? "Not enrolled yet"
            : course && level
              ? `${course} · ${level}`
              : course || level || "Enrolled";
          return (
            <li key={row.kidProfileId}>
              <NavLink
                href={`/dashboard/learn/kids-progress/${row.kidProfileId}`}
                data-testid="kid-row"
                className="flex h-[68px] items-center gap-3 rounded-[20px] bg-white px-3"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F7F5FC] text-[#1F1640] ${enrolled ? "" : "border-2 border-dashed border-[#C4B5FD]"}`}
                  style={enrolled ? { boxShadow: `0 0 0 2px ${ring}` } : undefined}
                >
                  <KidLucideIcon name={row.avatarIcon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-heading text-base font-bold text-[#1F1640]">{row.kidName}</span>
                  <span className="block truncate text-[11px] font-semibold text-[#6B5F8A]">{status}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#6B5F8A]" aria-hidden />
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
