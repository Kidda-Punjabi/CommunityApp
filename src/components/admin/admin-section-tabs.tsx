"use client";

type Tab = {
  id: string;
  label: string;
};

type AdminSectionTabsProps = {
  tabs: readonly Tab[];
  activeTab: string;
  onChange: (id: string) => void;
};

export function AdminSectionTabs({ tabs, activeTab, onChange }: AdminSectionTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === tab.id
              ? "bg-violet-600 text-white"
              : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
