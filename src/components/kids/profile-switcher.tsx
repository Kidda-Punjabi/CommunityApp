"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import { PinPad } from "@/components/kids/pin-pad";
import {
  KID_AGE_TIERS,
  KID_AVATAR_ICONS,
  type KidAgeTier,
  type KidAvatarIcon,
} from "@/lib/kids/constants";
import type { KidProfile } from "@/lib/kids/types";
import { pressableClass } from "@/lib/ui/pressable";
import { cn, ui } from "@/lib/ui/styles";

type ProfileSwitcherProps = {
  kidProfiles: KidProfile[];
  hasPin: boolean;
  parentName: string;
  kidActive?: boolean;
};

export function ProfileSwitcher({
  kidProfiles,
  hasPin,
  parentName,
  kidActive = false,
}: ProfileSwitcherProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [pendingKidId, setPendingKidId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parentPinOpen, setParentPinOpen] = useState(false);

  async function switchToKid(kidProfileId: string) {
    setError(null);
    const response = await fetch("/api/kids/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kidProfileId }),
    });
    const data = (await response.json()) as { error?: string; redirectTo?: string };
    if (!response.ok) {
      setError(data.error ?? "Could not switch profile.");
      return;
    }
    router.push(data.redirectTo ?? "/dashboard/learn");
    router.refresh();
  }

  async function handleParentCard() {
    if (kidProfiles.length === 0) {
      router.push("/dashboard/profile");
      return;
    }
    setError(null);
    if (kidActive && hasPin) {
      setParentPinOpen(true);
      return;
    }
    await switchToParent();
  }

  async function switchToParent(pin?: string) {
    if (kidActive) {
      const response = await fetch("/api/kids/exit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin ?? "" }),
      });
      const data = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not switch to parent account.");
        return;
      }
      setParentPinOpen(false);
      router.push(data.redirectTo ?? "/dashboard/learn");
      router.refresh();
      return;
    }

    const response = await fetch("/api/kids/switch", { method: "DELETE" });
    const data = (await response.json()) as { error?: string; redirectTo?: string };
    if (!response.ok) {
      setError(data.error ?? "Could not continue as parent.");
      return;
    }
    router.push(data.redirectTo ?? "/dashboard/learn");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-wrap items-start justify-center gap-x-8 gap-y-8">
        <button
          type="button"
          onClick={handleParentCard}
          className={cn(pressableClass, "group flex w-28 flex-col items-center")}
        >
          <span
            className={cn(
              "flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold ring-2 ring-transparent transition group-hover:ring-violet-600 group-hover:ring-offset-2 group-hover:ring-offset-zinc-50",
              ui.avatarParent
            )}
          >
            {parentName.charAt(0).toUpperCase()}
          </span>
          <span className="mt-3 text-center text-sm font-semibold text-zinc-900">{parentName}</span>
        </button>

        {kidProfiles.map((kid) => (
          <button
            key={kid.id}
            type="button"
            onClick={() => switchToKid(kid.id)}
            className={cn(pressableClass, "group flex w-28 flex-col items-center")}
          >
            <span
              className={cn(
                "flex h-24 w-24 items-center justify-center rounded-full ring-2 ring-transparent transition group-hover:ring-sky-400 group-hover:ring-offset-2 group-hover:ring-offset-zinc-50",
                ui.avatarKid
              )}
            >
              <KidLucideIcon name={kid.avatar_icon} className="h-12 w-12" />
            </span>
            <span className="mt-3 text-center text-sm font-semibold text-zinc-900">{kid.name}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className={cn(
            pressableClass,
            "group flex w-24 flex-col items-center text-zinc-400 hover:text-zinc-500"
          )}
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-zinc-300 text-3xl font-light transition group-hover:border-zinc-400">
            +
          </span>
          <span className="mt-3 text-center text-xs font-medium">Add profile</span>
        </button>
      </div>

      {error && <p className="mt-8 text-sm text-red-600">{error}</p>}

      {showCreate && (
        <CreateKidProfileDialog
          hasPin={hasPin}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            if (!hasPin) {
              setPendingKidId(id);
            } else {
              void switchToKid(id);
            }
            router.refresh();
          }}
        />
      )}

      {pendingKidId && (
        <PinSetupDialog
          onComplete={() => {
            setPendingKidId(null);
            void switchToKid(pendingKidId);
          }}
          onClose={() => setPendingKidId(null)}
        />
      )}

      {parentPinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6">
            <PinPad
              title="Enter your PIN"
              subtitle="To use your parent account"
              onComplete={(pin) => void switchToParent(pin)}
              onCancel={() => setParentPinOpen(false)}
              error={error}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CreateKidProfileDialog({
  hasPin,
  onClose,
  onCreated,
}: {
  hasPin: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [avatarIcon, setAvatarIcon] = useState<KidAvatarIcon>("Cat");
  const [ageTier, setAgeTier] = useState<KidAgeTier>("pre_reader");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/kids/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarIcon, ageTier }),
      });
      const data = (await response.json()) as { error?: string; profile?: { id: string } };
      if (!response.ok || !data.profile) {
        setError(data.error ?? "Failed to create profile.");
        return;
      }
      onCreated(data.profile.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-zinc-900">New kid profile</h2>

        <label className="mt-4 block text-sm font-medium text-zinc-700">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2"
        />

        <p className="mt-4 text-sm font-medium text-zinc-700">Pick an avatar</p>
        <div className="mt-2 grid grid-cols-6 gap-2">
          {KID_AVATAR_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => setAvatarIcon(icon)}
              className={`flex aspect-square items-center justify-center rounded-xl ${
                avatarIcon === icon ? "bg-violet-100 ring-2 ring-violet-500" : "bg-zinc-50"
              }`}
            >
              <KidLucideIcon name={icon} className="h-6 w-6 text-violet-600" />
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm font-medium text-zinc-700">Age tier</p>
        <div className="mt-2 space-y-2">
          {KID_AGE_TIERS.map((tier) => (
            <label key={tier.value} className="flex cursor-pointer gap-3 rounded-xl border border-zinc-200 p-3">
              <input
                type="radio"
                name="ageTier"
                value={tier.value}
                checked={ageTier === tier.value}
                onChange={() => setAgeTier(tier.value)}
              />
              <span>
                <span className="block text-sm font-semibold text-zinc-900">{tier.label}</span>
                <span className="text-xs text-zinc-500">{tier.description}</span>
              </span>
            </label>
          ))}
        </div>

        {!hasPin && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            After creating this profile, you&apos;ll set a 4-digit PIN to switch back to your
            account.
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PinSetupDialog({
  onComplete,
  onClose,
}: {
  onComplete: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function savePin(pin: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/kids/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: firstPin, confirmPin: pin }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not save PIN.");
        return;
      }
      onComplete();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6">
        <PinPad
          title={step === "enter" ? "Set a grown-up PIN" : "Confirm your PIN"}
          subtitle="You'll need this to switch back to your account"
          onComplete={(pin) => {
            if (step === "enter") {
              setFirstPin(pin);
              setStep("confirm");
            } else if (pin !== firstPin) {
              setError("PINs don't match. Try again.");
              setStep("enter");
              setFirstPin("");
            } else {
              void savePin(pin);
            }
          }}
          onCancel={onClose}
          error={error}
          disabled={loading}
        />
      </div>
    </div>
  );
}
