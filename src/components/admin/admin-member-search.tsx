"use client";

import { useEffect, useState } from "react";
import {
  searchAdminMembers,
  type AdminMemberOption,
} from "@/app/admin/content/actions";
import { UserAvatar } from "@/components/profile/user-avatar";

export function AdminMemberSearch({
  selected,
  onSelect,
}: {
  selected: AdminMemberOption | null;
  onSelect: (member: AdminMemberOption) => void;
}) {
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

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="flow-preview-member-search" className="block text-sm font-medium text-zinc-700">
          Search a student
        </label>
        <input
          id="flow-preview-member-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name or email…"
          className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-zinc-500">Type at least 2 characters. Same lookup as announcements.</p>
      </div>

      {selected ? (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <UserAvatar
            profile={{
              full_name: selected.displayName,
              preferred_name: null,
              avatar_url: selected.avatarUrl,
            }}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900">{selected.displayName}</p>
            {selected.email ? (
              <p className="truncate text-xs text-zinc-500">{selected.email}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {searching ? <p className="text-sm text-zinc-500">Searching…</p> : null}
      {searchError ? <p className="text-sm text-red-600">{searchError}</p> : null}

      {results.length > 0 ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1">
          {results.map((member) => (
            <li key={member.userId}>
              <button
                type="button"
                onClick={() => {
                  onSelect(member);
                  setQuery("");
                  setResults([]);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-violet-50"
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
                  {member.email ? (
                    <span className="block truncate text-xs text-zinc-500">{member.email}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
