import { logout } from "./actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
      >
        Log out
      </button>
    </form>
  );
}
