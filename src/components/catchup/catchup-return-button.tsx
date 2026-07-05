"use client";

import Link from "next/link";
import { parseCatchupReturn } from "@/lib/catchup/return-url";

export function CatchupReturnButton({ returnUrl }: { returnUrl: string | null | undefined }) {
  const parsed = parseCatchupReturn(returnUrl);
  if (!parsed) return null;

  return (
    <Link
      href={returnUrl!}
      className="block rounded-lg bg-violet-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-violet-500"
    >
      Continue catch-up lesson
    </Link>
  );
}
