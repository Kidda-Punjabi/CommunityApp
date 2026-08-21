const TABS = [
  { label: "Home", description: "Weekly courses and lessons at your own pace" },
  { label: "Practise", description: "Your path — streak, unlockables, and today's focus" },
  { label: "Games", description: "Vocabulary and grammar practice — tap ? in any game for how to play" },
  { label: "Community", description: "Leaderboard, events, forum, and friends" },
  { label: "Profile", description: "Progress, streak, level, and settings" },
] as const;

export function TabBarPreview() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="flex items-stretch justify-around gap-1">
          {TABS.map((tab, index) => (
            <div key={tab.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  index === 0
                    ? "bg-violet-100 text-violet-600"
                    : index === 2
                      ? "bg-violet-50 text-violet-500 ring-1 ring-violet-200"
                      : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {tab.label.slice(0, 1)}
              </span>
              <span
                className={`text-[10px] font-semibold ${
                  index === 0 || index === 2 ? "text-violet-600" : "text-zinc-500"
                }`}
              >
                {tab.label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] text-zinc-400">
          Bottom navigation — five tabs for the whole app
        </p>
      </div>

      <ul className="space-y-2 text-sm text-zinc-600">
        {TABS.map((tab) => (
          <li key={tab.label}>
            <span className="font-semibold text-zinc-800">{tab.label}:</span> {tab.description}
          </li>
        ))}
      </ul>
    </div>
  );
}
