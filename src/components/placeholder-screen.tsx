type PlaceholderScreenProps = {
  emoji: string;
  title: string;
  description: string;
};

export function PlaceholderScreen({
  emoji,
  title,
  description,
}: PlaceholderScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/80">
        <span className="text-5xl" role="img" aria-hidden="true">
          {emoji}
        </span>
      </div>
      <h1 className="mt-8 text-2xl font-bold tracking-tight text-zinc-900">
        {title}
      </h1>
      <p className="mt-3 max-w-xs text-base leading-relaxed text-zinc-500">
        {description}
      </p>
    </div>
  );
}
