"use client";

import { logout } from "./actions";
import { deleteDevicePushToken } from "@/app/dashboard/push/actions";

export function LogoutButton() {
  return (
    <form
      action={async () => {
        const token = localStorage.getItem("kidda.pushToken");
        if (token) await deleteDevicePushToken(token);
        localStorage.removeItem("kidda.pushToken");
        await logout();
      }}
    >
      <button
        type="submit"
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
      >
        Log out
      </button>
    </form>
  );
}
