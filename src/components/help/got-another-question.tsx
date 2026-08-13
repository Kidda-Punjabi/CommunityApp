import { HELP_CONTACT_EMAIL, helpQuestionMailtoHref } from "@/lib/help/contact";
import { ui } from "@/lib/ui/styles";

type GotAnotherQuestionProps = {
  className?: string;
  subject?: string;
};

export function GotAnotherQuestion({
  className,
  subject = "Question from the Kidda app",
}: GotAnotherQuestionProps) {
  return (
    <div className={className ?? "mt-10"}>
      <div className={ui.cardBordered}>
        <p className="text-sm font-semibold text-zinc-900">Got another question?</p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-600">
          If you can&apos;t find what you need here, email the Kidda team and we&apos;ll help.
        </p>
        <a
          href={helpQuestionMailtoHref(subject)}
          className={`${ui.btnPrimary} mt-4`}
        >
          Email {HELP_CONTACT_EMAIL}
        </a>
      </div>
    </div>
  );
}
