export default function HomeworkLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 py-7">
      <div className="h-4 w-28 animate-pulse rounded-full bg-zinc-200" />
      <div className="mt-5 h-8 w-40 animate-pulse rounded-full bg-zinc-200" />
      <div className="mt-6 space-y-3">
        <div className="h-28 animate-pulse rounded-3xl bg-zinc-100" />
        <div className="h-28 animate-pulse rounded-3xl bg-zinc-100" />
        <div className="h-28 animate-pulse rounded-3xl bg-zinc-100" />
      </div>
    </div>
  );
}
