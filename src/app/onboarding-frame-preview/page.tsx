import { PreviewStep, type PreviewStepName } from "@/app/onboarding-frame-preview/preview-step";
import { ui } from "@/lib/ui/styles";
import { notFound } from "next/navigation";

const STEPS = ["welcome", "session", "why", "levels", "placement", "done"] as const;

/** Dev-only stand-in for the dashboard shell, so the layout test can open every onboarding frame without a session. */
export default async function OnboardingFramePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { step } = await searchParams;
  const name = STEPS.includes(step as PreviewStepName) ? (step as PreviewStepName) : "welcome";

  return (
    <div className={`flex min-h-dvh flex-col ${ui.pageBg}`}>
      <div className={`relative mx-auto flex w-full max-w-lg flex-1 flex-col ${ui.navClearance}`}>
        <PreviewStep step={name} />
      </div>
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200/60 bg-white/90 shadow-[0_-4px_24px_-8px_rgba(24,24,27,0.08)] backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
          <span className="flex flex-1 flex-col items-center gap-1 px-1 py-1 text-[10px] font-semibold text-zinc-500">
            <span className="h-8 w-8" />
            Home
          </span>
        </div>
      </nav>
    </div>
  );
}
