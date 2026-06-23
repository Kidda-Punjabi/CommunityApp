type TutorPageHeaderProps = {
  title: string;
  subtitle?: string;
};

export function TutorPageHeader({ title, subtitle }: TutorPageHeaderProps) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
        Tutor
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
    </div>
  );
}
