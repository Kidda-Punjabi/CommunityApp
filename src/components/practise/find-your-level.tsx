import Link from "next/link";
import { ArenaArt } from "./arena-art";

export function FindYourLevel() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-6 pt-3">
      <div className="relative h-64 overflow-hidden rounded-3xl">
        <ArenaArt level={0} />
        <Link href="/dashboard/home?view=previous" className="absolute right-3 top-3 flex min-h-10 items-center rounded-full bg-white/95 px-3 text-[13px] font-extrabold text-zinc-900">
          Previous practice
        </Link>
      </div>
      <h1 className="mt-5 font-heading text-3xl font-bold tracking-tight text-zinc-900">Find your level</h1>
      <p className="mt-2 text-base font-medium leading-snug text-zinc-700">
        New practise is here. Answer a few questions and we will show you exactly what to work on.
      </p>
      <Link href="/dashboard/community/placement" className="mt-6 flex h-[72px] flex-col items-center justify-center rounded-[20px] bg-violet-600 text-white shadow-lg shadow-violet-900/25">
        <span className="text-2xl font-extrabold">Start</span>
        <span className="text-[13px] font-bold opacity-90">A few quick questions</span>
      </Link>
    </div>
  );
}
