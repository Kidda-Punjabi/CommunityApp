"use client";

type Tab = {
  id: string;
  label: string;
};

type AdminSectionTabsProps = {
  tabs: readonly Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  badges?: Record<string, number>;
};

export function AdminSectionTabs({ tabs, activeTab, onChange, badges }: AdminSectionTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const badge = badges?.[tab.id] ?? 0;
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              selected
                ? "bg-violet-600 text-white"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {tab.label}
            {badge > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  selected ? "bg-white text-red-600" : "bg-red-600 text-white"
                }`}
              >
                {badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
