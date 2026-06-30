import { switchAccount } from "@/app/login/switch-account";
import type { ContinueAsUser } from "@/lib/auth/continue-as-user";
import Link from "next/link";

type ContinueAsUserCardProps = {
  user: ContinueAsUser;
  variant?: "home" | "auth";
  showSwitchLink?: boolean;
};

function UserAvatarBubble({
  displayName,
  avatarUrl,
  size,
}: {
  displayName: string;
  avatarUrl: string | null;
  size: "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "h-14 w-14 text-xl" : "h-12 w-12 text-lg";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-100 font-semibold text-violet-700 ${sizeClass}`}
      aria-hidden="true"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

export function ContinueAsUserCard({
  user,
  variant = "auth",
  showSwitchLink = true,
}: ContinueAsUserCardProps) {
  const continueHref = user.sessionActive ? "/dashboard/home" : `/login?email=${encodeURIComponent(user.email)}`;

  if (variant === "home") {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <Link
          href={continueHref}
          className="flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-left shadow-sm transition-colors hover:border-violet-200 hover:bg-violet-50/50"
        >
          <UserAvatarBubble
            displayName={user.displayName}
            avatarUrl={user.avatarUrl}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900">
              Continue as {user.displayName}
            </p>
            <p className="truncate text-sm text-zinc-500">{user.email}</p>
          </div>
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row">
          <form action={switchAccount} className="flex-1 sm:flex-initial">
            <button
              type="submit"
              className="w-full rounded-lg border border-zinc-300 bg-white px-6 py-3 text-center text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Use another account
            </button>
          </form>
          <Link
            href="/signup"
            className="rounded-lg border border-zinc-300 bg-white px-6 py-3 text-center text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-4">
        <UserAvatarBubble
          displayName={user.displayName}
          avatarUrl={user.avatarUrl}
          size="md"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">
            {user.sessionActive ? `Continue as ${user.displayName}` : `Welcome back, ${user.displayName}`}
          </p>
          <p className="truncate text-sm text-zinc-500">{user.email}</p>
        </div>
      </div>

      {user.sessionActive ? (
        <Link
          href="/dashboard/home"
          className="block w-full rounded-lg bg-violet-600 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-violet-500"
        >
          Continue
        </Link>
      ) : null}

      {showSwitchLink ? (
        <p className="text-center text-sm text-zinc-500">
          <form action={switchAccount} className="inline">
            <button
              type="submit"
              className="font-medium text-violet-600 hover:text-violet-500"
            >
              Use another account
            </button>
          </form>
        </p>
      ) : null}
    </div>
  );
}
