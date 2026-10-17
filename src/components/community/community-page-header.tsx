import Link from "next/link";

export function CommunityPageHeader({ title }: { title: string }) {
  return (
    <header className="pt-[env(safe-area-inset-top)] font-[family-name:var(--font-community)]">
      <Link href="/dashboard/community" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#4A3F66]">
        Back
      </Link>
      <h1 className="font-heading text-2xl font-extrabold text-[#1F1640]">{title}</h1>
    </header>
  );
}
