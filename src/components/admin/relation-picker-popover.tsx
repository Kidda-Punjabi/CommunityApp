"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  searchPackageRosterCandidatesAction,
  type PackageRosterCandidateOption,
} from "@/app/admin/packages/actions";
import { UserAvatar } from "@/components/profile/user-avatar";

export type RelationPickerItem = {
  id: string;
  userId: string | null;
  label: string;
  email: string | null;
  avatarUrl: string | null;
  /** When false, the row is shown but cannot be removed (e.g. Notion-only lead). */
  removable?: boolean;
};

type RelationPickerPopoverProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  selected: RelationPickerItem[];
  excludedUserIds: string[];
  onAdd: (candidate: PackageRosterCandidateOption) => void;
  onRemove: (item: RelationPickerItem) => void;
  pending?: boolean;
  error?: string | null;
};

const GAP = 6;
const VIEWPORT_PADDING = 8;
const MIN_WIDTH = 280;
const MAX_WIDTH = 360;

function computePopoverPosition(
  anchorRect: DOMRect,
  panelHeight: number
): { top: number; left: number; width: number } {
  const width = Math.min(
    Math.max(anchorRect.width, MIN_WIDTH),
    Math.min(MAX_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2)
  );

  let left = anchorRect.left;
  if (left + width > window.innerWidth - VIEWPORT_PADDING) {
    left = window.innerWidth - width - VIEWPORT_PADDING;
  }
  left = Math.max(VIEWPORT_PADDING, left);

  const spaceBelow = window.innerHeight - anchorRect.bottom - GAP - VIEWPORT_PADDING;
  const spaceAbove = anchorRect.top - GAP - VIEWPORT_PADDING;
  const preferredHeight = Math.min(panelHeight, 360);

  let top: number;
  if (spaceBelow >= preferredHeight || spaceBelow >= spaceAbove) {
    top = anchorRect.bottom + GAP;
  } else {
    top = anchorRect.top - GAP - Math.min(preferredHeight, spaceAbove);
  }

  top = Math.max(VIEWPORT_PADDING, top);

  return { top, left, width };
}

export function RelationPickerPopover({
  open,
  anchorRef,
  onClose,
  selected,
  excludedUserIds,
  onAdd,
  onRemove,
  pending = false,
  error = null,
}: RelationPickerPopoverProps) {
  const searchId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PackageRosterCandidateOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const anchorRect = anchor.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 320;
      setPosition(computePopoverPosition(anchorRect, panelHeight));
    }

    updatePosition();

    const raf = window.requestAnimationFrame(updatePosition);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorRef, selected.length, results.length, query, error]);

  useLayoutEffect(() => {
    if (!open) return;
    searchRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSearchError(null);
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      void searchPackageRosterCandidatesAction(trimmed).then((response) => {
        setSearching(false);
        if (response.error) {
          setSearchError(response.error);
          setResults([]);
          return;
        }
        setResults(response.results ?? []);
      });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [open, query]);

  if (!open) return null;

  const excluded = new Set(excludedUserIds);
  const candidates = results.filter(
    (member) => !member.userId || !excluded.has(member.userId)
  );

  const panelStyle = position ?? {
    top: VIEWPORT_PADDING,
    left: VIEWPORT_PADDING,
    width: MIN_WIDTH,
  };

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Edit relation"
      className={`fixed z-[70] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl${position ? "" : " pointer-events-none opacity-0"}`}
      style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
    >
      <div className="border-b border-zinc-100 p-2">
        <input
          ref={searchRef}
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for a person…"
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
          autoComplete="off"
        />
      </div>

      <div className="max-h-72 overflow-y-auto p-2">
        {selected.length > 0 ? (
          <ul className="space-y-0.5">
            {selected.map((item) => {
              const canRemove = item.removable !== false && item.userId;
              return (
                <li key={item.id}>
                  <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50">
                    <UserAvatar
                      profile={{
                        full_name: item.label,
                        preferred_name: null,
                        avatar_url: item.avatarUrl,
                      }}
                      size="xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{item.label}</p>
                      {item.email ? (
                        <p className="truncate text-xs text-zinc-500">{item.email}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={pending || !canRemove}
                      onClick={() => onRemove(item)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Remove ${item.label}`}
                      title={
                        canRemove
                          ? "Remove"
                          : "This lead is mirrored from Notion and has no linked profile yet."
                      }
                    >
                      <MinusIcon />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-2 py-1 text-sm text-zinc-500">No one selected yet.</p>
        )}

        <p className="mt-3 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Select more
        </p>

        {searching ? <p className="px-2 py-2 text-sm text-zinc-500">Searching…</p> : null}
        {searchError ? <p className="px-2 py-2 text-sm text-red-600">{searchError}</p> : null}
        {!searching && query.trim().length < 2 ? (
          <p className="px-2 py-2 text-sm text-zinc-500">Type at least 2 characters to search.</p>
        ) : null}
        {!searching && query.trim().length >= 2 && candidates.length === 0 ? (
          <p className="px-2 py-2 text-sm text-zinc-500">No matches.</p>
        ) : null}

        {candidates.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {candidates.map((member) => (
              <li key={member.notionLeadPageId ?? member.userId ?? member.displayName}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!member.canAdd || !member.userId) {
                      setSearchError(
                        member.unavailableReason ??
                          "This person cannot be added to a package yet."
                      );
                      return;
                    }
                    setSearchError(null);
                    onAdd(member);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left disabled:opacity-50 ${
                    member.canAdd ? "hover:bg-violet-50" : "hover:bg-zinc-50"
                  }`}
                >
                  <UserAvatar
                    profile={{
                      full_name: member.displayName,
                      preferred_name: null,
                      avatar_url: member.avatarUrl,
                    }}
                    size="xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {member.displayName}
                    </p>
                    {member.email ? (
                      <p className="truncate text-xs text-zinc-500">{member.email}</p>
                    ) : null}
                    {member.source === "notion_lead" && !member.canAdd ? (
                      <p className="truncate text-xs text-amber-600">Notion lead · no app account</p>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <div className="border-t border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );

  return createPortal(panel, document.body);
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
