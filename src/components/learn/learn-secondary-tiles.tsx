import { NavLink } from "@/components/ui/nav-link";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { Users, Wrench } from "lucide-react";

const SECONDARY = [
  {
    id: "community",
    href: "",
    title: "Community",
    status: "",
    Icon: Users,
  },
  {
    id: "resources",
    href: "/dashboard/learn/resources",
    title: "Resources",
    status: "Tools & shortcuts",
    Icon: Wrench,
  },
] as const;

type LearnSecondaryTilesProps = {
  communityHref: string;
  communityStatus: string;
};

export function LearnSecondaryTiles({
  communityHref,
  communityStatus,
}: LearnSecondaryTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {SECONDARY.map((tile) => {
        const href = tile.id === "community" ? communityHref : tile.href;
        const status = tile.id === "community" ? communityStatus : tile.status;
        const Icon = tile.Icon;
        return (
          <NavLink
            key={tile.id}
            href={href}
            data-tour={`learn-tile-${tile.id}`}
            className={cn(
              pressableClass,
              "flex min-h-[7.5rem] flex-col rounded-2xl bg-zinc-100 p-3.5 text-zinc-600 shadow-[0_1px_8px_-4px_rgba(24,24,27,0.06)] hover:bg-zinc-50"
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-200/80 text-zinc-500">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-auto font-heading text-sm font-semibold text-zinc-700">{tile.title}</p>
            <p className="mt-0.5 text-[11px] font-medium text-zinc-500">{status}</p>
          </NavLink>
        );
      })}
    </div>
  );
}
