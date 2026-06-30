import { BOOK_CALL_PATH } from "@/lib/booking/constants";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

type BookCallCardProps = {
  variant?: "default" | "compact";
};

export function BookCallCard({ variant = "default" }: BookCallCardProps) {
  if (variant === "compact") {
    return (
      <Link href={BOOK_CALL_PATH} className={`${ui.cardInteractive} block text-center`}>
        <p className="text-sm font-semibold text-zinc-900">Not sure which course is right?</p>
        <p className="mt-1 text-sm text-violet-600">Book a free call with our team →</p>
      </Link>
    );
  }

  return (
    <div className={ui.card}>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Talk to us
      </p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
        Book a free call with the Kidda team. We&apos;ll help you choose the right course or
        answer any questions before you buy.
      </p>
      <Link href={BOOK_CALL_PATH} className={`mt-4 ${ui.btnSecondary}`}>
        Book a call
      </Link>
    </div>
  );
}
