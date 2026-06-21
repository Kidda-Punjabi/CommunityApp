"use client";

import { useEffect, useState } from "react";
import {
  searchAdminMembers,
  type AdminMemberOption,
} from "@/app/admin/content/actions";
import { UserAvatar } from "@/components/profile/user-avatar";

type AnnouncementMemberPickerProps = {
  selected: AdminMemberOption[];
  onChange: (members: AdminMemberOption[]) => void;
};

export function AnnouncementMemberPicker({
  selected,
  onChange,
}: AnnouncementMemberPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminMemberOption[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);

      void searchAdminMembers(trimmed).then((response) => {
        setSearching(false);
        if (response.error) {
          setSearchError(response.error);
          setResults([]);
          return;
        }
        setResults(response.results ?? []);
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  function addMember(member: AdminMemberOption) {
    if (selected.some((item) => item.userId === member.userId)) return;
    onChange([...selected, member]);
    setQuery("");
    setResults([]);
  }

  function removeMember(userId: string) {
    onChange(selected.filter((member) => member.userId !== userId));
  }

  const selectedIds = new Set(selected.map((member) => member.userId));

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="member-search" className="block text-sm font-medium text-zinc-700">
          Search members
        </label>
        <input
          id="member-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name or email…"
          className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-zinc-500">Type at least 2 characters to search.</p>
      </div>

      {searching && <p className="text-sm text-zinc-500">Searching…</p>}
      {searchError && <p className="text-sm text-red-600">{searchError}</p>}

      {results.length > 0 && (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1">
          {results.map((member) => {
            const isSelected = selectedIds.has(member.userId);
            return (
              <li key={member.userId}>
                <button
                  type="button"
                  disabled={isSelected}
                  onClick={() => addMember(member)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-violet-50 disabled:cursor-default disabled:opacity-50"
                >
                  <UserAvatar
                    profile={{
                      full_name: member.displayName,
                      preferred_name: null,
                      avatar_url: member.avatarUrl,
                    }}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-900">
                      {member.displayName}
                    </span>
                    {member.email && (
                      <span className="block truncate text-xs text-zinc-500">{member.email}</span>
                    )}
                  </span>
                  {isSelected && (
                    <span className="text-xs font-medium text-violet-600">Added</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Selected ({selected.length})
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {selected.map((member) => (
              <li key={member.userId}>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 py-1 pl-2 pr-1 text-sm text-violet-900">
                  {member.displayName}
                  <button
                    type="button"
                    onClick={() => removeMember(member.userId)}
                    className="rounded-full px-1.5 text-violet-600 hover:bg-violet-200"
                    aria-label={`Remove ${member.displayName}`}
                  >
                    ×
                  </button>
                </span>
                <input type="hidden" name="recipient_ids" value={member.userId} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
