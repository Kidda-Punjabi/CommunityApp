"use client";

import { AdminServerError } from "./admin-server-error";

export default function AdminContentError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AdminServerError
      message={error.message || "An unexpected server error occurred."}
    />
  );
}
