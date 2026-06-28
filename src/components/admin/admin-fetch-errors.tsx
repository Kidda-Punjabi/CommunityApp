"use client";

import type { AdminData } from "@/app/admin/content/types";

export function AdminFetchErrors({ errors }: { errors?: AdminData["errors"] }) {
  const fetchErrors = Object.entries(errors ?? {}).filter(([, value]) => value);
  if (fetchErrors.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p className="font-semibold">Some admin data failed to load:</p>
      <ul className="mt-1 list-disc pl-5">
        {fetchErrors.map(([key, value]) => (
          <li key={key}>
            {key}: {value}
          </li>
        ))}
      </ul>
    </div>
  );
}
