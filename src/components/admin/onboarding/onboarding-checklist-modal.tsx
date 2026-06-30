"use client";

import { useEffect, useState, useTransition } from "react";
import {
  fetchOnboardingChecklist,
  upsertOnboardingChecklist,
} from "@/app/admin/packages/actions";
import { ONBOARDING_CHECKLIST_COLUMNS } from "@/lib/admin/onboarding/checklist-fields";
import type { OnboardingChecklistRow } from "@/lib/admin/packages/types";
import { ui } from "@/lib/ui/styles";

const EMPTY_CHECKLIST = (
  checklistType: "group" | "one_to_one"
): OnboardingChecklistRow => ({
  id: "",
  checklistType,
  timeAssigned: false,
  welcomeEmail: false,
  calendarInvite: false,
  tutorNotified: false,
  packageCreated: false,
  whatsappChatMade: false,
  scheduleWhatsappChat: false,
  onboardingCompleted: false,
  paymentDate: null,
  notes: null,
});

const CHECKLIST_FIELDS = ONBOARDING_CHECKLIST_COLUMNS.map((column) => ({
  key: column.key,
  label: column.label,
}));

type OnboardingChecklistModalProps = {
  studentPackageId: string;
  studentLabel: string;
  checklistType: "group" | "one_to_one";
  title?: string;
  onClose: () => void;
  onSaved?: () => void;
};

export function OnboardingChecklistModal({
  studentPackageId,
  studentLabel,
  checklistType,
  title = "Onboarding checklist",
  onClose,
  onSaved,
}: OnboardingChecklistModalProps) {
  const [checklist, setChecklist] = useState<OnboardingChecklistRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetchOnboardingChecklist(studentPackageId).then((result) => {
      setChecklist(result.checklist);
      setError(result.error ?? null);
      setLoading(false);
    });
  }, [studentPackageId]);

  function toggleField(key: keyof OnboardingChecklistRow) {
    setChecklist((current) => {
      const base = current ?? EMPTY_CHECKLIST(checklistType);
      return { ...base, [key]: !base[key] };
    });
  }

  function save() {
    startTransition(async () => {
      const result = await upsertOnboardingChecklist(studentPackageId, checklistType, {
        id: checklist?.id,
        timeAssigned: checklist?.timeAssigned,
        welcomeEmail: checklist?.welcomeEmail,
        calendarInvite: checklist?.calendarInvite,
        tutorNotified: checklist?.tutorNotified,
        packageCreated: checklist?.packageCreated,
        whatsappChatMade: checklist?.whatsappChatMade,
        scheduleWhatsappChat: checklist?.scheduleWhatsappChat,
        onboardingCompleted: checklist?.onboardingCompleted,
        paymentDate: checklist?.paymentDate,
        notes: checklist?.notes,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved?.();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center sm:py-8">
      <div className="flex max-h-[min(90dvh,calc(100dvh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
            <p className="text-sm text-zinc-500">{studentLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {loading && <p className="text-sm text-zinc-500">Loading…</p>}
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

          {!loading && (
            <div className="space-y-3">
              {CHECKLIST_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center gap-3 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={Boolean(checklist?.[field.key])}
                    onChange={() => toggleField(field.key)}
                  />
                  {field.label}
                </label>
              ))}
              <label className="block text-sm text-zinc-700">
                Payment date
                <input
                  type="date"
                  value={checklist?.paymentDate ?? ""}
                  onChange={(e) =>
                    setChecklist((current) => ({
                      ...(current ?? EMPTY_CHECKLIST(checklistType)),
                      paymentDate: e.target.value || null,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm text-zinc-700">
                Notes
                <textarea
                  value={checklist?.notes ?? ""}
                  onChange={(e) =>
                    setChecklist((current) => ({
                      ...(current ?? EMPTY_CHECKLIST(checklistType)),
                      notes: e.target.value,
                    }))
                  }
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                />
              </label>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-100 bg-white px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={save}
            disabled={pending || loading}
            className={ui.btnPrimary}
          >
            Save checklist
          </button>
        </div>
      </div>
    </div>
  );
}
