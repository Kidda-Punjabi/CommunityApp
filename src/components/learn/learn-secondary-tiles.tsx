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
  communityLocked?: boolean;
};

export function LearnSecondaryTiles({
  communityHref,
  communityStatus,
  communityLocked = false,
}: LearnSecondaryTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {SECONDARY.map((tile) => {
        const href = tile.id === "community" ? communityHref : tile.href;
        const status = tile.id === "community" ? communityStatus : tile.status;
        const Icon = tile.Icon;
        const muted = tile.id === "community" && communityLocked;
        return (
          <NavLink
            key={tile.id}
            href={href}
            data-tour={`learn-tile-${tile.id}`}
            className={cn(
              pressableClass,
              "flex min-h-[7.5rem] flex-col rounded-2xl p-3.5 shadow-[0_1px_8px_-4px_rgba(24,24,27,0.06)]",
              muted
                ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-50"
                : tile.id === "resources"
                  ? "bg-sky-100 text-sky-950 hover:bg-sky-50"
                  : "bg-rose-100 text-rose-950 hover:bg-rose-50"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl",
                muted
                  ? "bg-zinc-200/80 text-zinc-400"
                  : tile.id === "resources"
                    ? "bg-sky-600/15 text-sky-700"
                    : "bg-rose-600/15 text-rose-700"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <p
              className={cn(
                "mt-auto font-heading text-sm font-semibold",
                muted ? "text-zinc-600" : tile.id === "resources" ? "text-sky-950" : "text-rose-950"
              )}
            >
              {tile.title}
            </p>
            <p
              className={cn(
                "mt-0.5 text-[11px] font-medium",
                muted ? "text-zinc-500" : tile.id === "resources" ? "text-sky-800/80" : "text-rose-800/80"
              )}
            >
              {status}
            </p>
          </NavLink>
        );
      })}
    </div>
  );
}
