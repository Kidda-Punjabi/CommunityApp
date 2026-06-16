import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 px-6 py-24">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">
          Kidda
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Your community membership platform
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-zinc-500">
          Access exclusive content, events, quizzes, and more.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <Link
          href="/login"
          className="rounded-lg bg-violet-600 px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-violet-500"
        >
          Sign in
        </Link>
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
