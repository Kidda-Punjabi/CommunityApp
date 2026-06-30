import Link from "next/link";
import { ui } from "@/lib/ui/styles";

type HelpArticlesLinkProps = {
  href: string;
  className?: string;
};

export function HelpArticlesLink({ href, className }: HelpArticlesLinkProps) {
  return (
    <Link href={href} className={className ?? ui.cardInteractive}>
      <p className="font-semibold text-zinc-900">Help articles</p>
      <p className="mt-1 text-sm text-zinc-500">
        FAQs and step-by-step guides for using Kidda — homework, lessons, billing, and more.
      </p>
      <p className="mt-2 text-sm font-semibold text-violet-600">Browse help →</p>
    </Link>
  );
}
