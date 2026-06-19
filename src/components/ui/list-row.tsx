import Link from "next/link";
import { ui } from "@/lib/ui/styles";

type ListRowProps = {
  href: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  emoji?: string;
  showPlayButton?: boolean;
  trailing?: React.ReactNode;
  className?: string;
};

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4" aria-hidden="true">
      <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.04-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}

export function ListRow({
  href,
  title,
  subtitle,
  icon,
  emoji,
  showPlayButton = true,
  trailing,
  className,
}: ListRowProps) {
  return (
    <Link href={href} className={`group ${ui.listRow} ${className ?? ""}`}>
      {icon ?? (
        <span className={ui.listRowIcon} aria-hidden="true">
          {emoji}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-heading font-semibold text-zinc-900">{title}</p>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {trailing ??
        (showPlayButton ? (
          <span className={ui.btnIcon} aria-hidden="true">
            <PlayIcon />
          </span>
        ) : null)}
    </Link>
  );
}
