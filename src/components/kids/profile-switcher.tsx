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

type ProfileSwitcherProps = {
  kidProfiles: KidProfile[];
  hasPin: boolean;
  pinUnlocked: boolean;
  parentName: string;
  showManage?: boolean;
};

export function ProfileSwitcher({
  kidProfiles,
  hasPin,
  pinUnlocked,
  parentName,
  showManage = true,
}: ProfileSwitcherProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [pendingKidId, setPendingKidId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionUnlocked, setSessionUnlocked] = useState(pinUnlocked);
  const unlocked = sessionUnlocked || !hasPin;

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
    const response = await fetch("/api/kids/switch", { method: "DELETE" });
    const data = (await response.json()) as { error?: string; redirectTo?: string };
    if (!response.ok) {
      setError(data.error ?? "Could not switch to parent account.");
      return;
    }
    router.push(data.redirectTo ?? "/dashboard/home");
    router.refresh();
  }

  async function handleUnlockPin(pin: string) {
    const response = await fetch("/api/kids/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Incorrect PIN.");
      return;
    }
    setError(null);
    setSessionUnlocked(true);
    router.refresh();
  }

  if (hasPin && !unlocked) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">
          Enter your PIN to switch between profiles. You won&apos;t be asked again this session.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6">
          <PinPad
            title="Enter your PIN"
            subtitle="Unlock the profile switcher"
            onComplete={handleUnlockPin}
            error={error}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Choose who is learning. Kid profiles stay on your membership — no separate login.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleParentCard}
          className="flex flex-col items-center rounded-3xl border-2 border-violet-200 bg-violet-50 p-6 text-center hover:border-violet-400"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-600 text-2xl font-bold text-white">
            {parentName.charAt(0).toUpperCase()}
          </span>
          <span className="mt-3 font-semibold text-zinc-900">{parentName}</span>
          <span className="mt-1 text-xs text-zinc-500">Parent account</span>
        </button>

        {kidProfiles.map((kid) => (
          <button
            key={kid.id}
            type="button"
            onClick={() => switchToKid(kid.id)}
            className="flex flex-col items-center rounded-3xl border-2 border-sky-200 bg-sky-50 p-6 text-center hover:border-sky-400"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-400 text-white">
              <KidLucideIcon name={kid.avatar_icon} className="h-9 w-9" />
            </span>
            <span className="mt-3 font-semibold text-zinc-900">{kid.name}</span>
            <span className="mt-1 text-xs text-zinc-500 capitalize">
              {kid.age_tier.replace("_", " ")}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex min-h-[10rem] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-300 p-6 text-zinc-500 hover:border-violet-300 hover:text-violet-600"
        >
          <span className="text-3xl">+</span>
          <span className="mt-2 text-sm font-semibold">Add kid profile</span>
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

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

      {showManage ? (
        <LinkRow href="/dashboard/profile/kids/manage" label="Manage kid profiles & PIN" />
      ) : null}
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500">
      {label}
    </a>
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
