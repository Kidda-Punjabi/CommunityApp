"use client";

export function ExamplePlay({ url }: { url: string | null }) {
  return (
    <button
      type="button"
      aria-label="Play the example"
      onClick={() => {
        if (!url) return;
        void new Audio(url).play();
      }}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-xs font-bold text-white active:scale-95"
    >
      Play
    </button>
  );
}
