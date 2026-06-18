import { resetViewAsCourses } from "@/app/dashboard/profile/view-as-actions";

type ViewAsBannerProps = {
  label: string;
};

async function handleReset() {
  "use server";
  await resetViewAsCourses();
}

export function ViewAsBanner({ label }: ViewAsBannerProps) {
  return (
    <div className="border-b border-violet-200 bg-violet-100 px-4 py-3">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <p className="text-sm font-medium text-violet-900">
          Viewing as: <span className="font-semibold">{label}</span>
        </p>
        <form action={handleReset}>
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
          >
            Reset
          </button>
        </form>
      </div>
    </div>
  );
}
