"use client";

import { pickMainSession } from "@/app/dashboard/community/actions";
import { OnboardingButton, OnboardingFrame } from "@/components/community/onboarding-shell";
import { formatClockShort, formatStartDate, formatWeekdayDate, zoneCity } from "@/lib/community/format";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type SessionChoice = {
  id: string;
  weekdayLabel: string;
  startsAt: string;
  hostTimeZone: string;
  hostCity: string;
  running: boolean;
  cardName: string | null;
  firstStartsOn: string | null;
};

export function SessionPicker({ sessions, error }: { sessions: SessionChoice[]; error?: string }) {
  const router = useRouter();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const city = zoneCity(zone);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState(error ?? "");
  const running = sessions.filter((session) => session.running);
  const later = sessions.filter((session) => !session.running);
  const choice = sessions.find((session) => session.id === selected);

  useEffect(() => {
    router.prefetch("/dashboard/community/welcome/why");
  }, [router, selected]);

  async function save() {
    if (!choice) return;
    document.cookie = `community_pending_session=${choice.id}; path=/; max-age=120`;
    router.push("/dashboard/community/welcome/why");
    const result = await pickMainSession(choice.id);
    if ("error" in result && result.error) {
      document.cookie = "community_pending_session=; path=/; max-age=0";
      setMessage("We couldn't save that session. Please try again.");
      router.replace("/dashboard/community/welcome/session?error=1");
    }
  }

  const buttonLabel = choice
    ? `Yes, ${choice.weekdayLabel}s at ${formatClockShort(choice.startsAt, zone)}`
    : "Choose a session";

  return (
    <OnboardingFrame
      step="1 of 3"
      backHref="/dashboard/community/welcome"
      action={<OnboardingButton onClick={save} disabled={!choice}>{buttonLabel}</OnboardingButton>}
    >
      <div>
        <h1 className="font-heading text-[1.65rem] font-extrabold leading-tight">When&apos;s your main session?</h1>
        <p className="mt-1 text-sm text-[#6B5F8A]">Times shown in your time ({city})</p>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#6B5F8A]">Sessions running now</p>
        <div className="mt-2 space-y-2">
          {running.map((session) => (
            <SessionCard key={session.id} session={session} zone={zone} selected={selected === session.id} onSelect={setSelected} large />
          ))}
        </div>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#6B5F8A]">Starting soon for other time zones</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {later.map((session) => (
            <SessionCard key={session.id} session={session} zone={zone} selected={selected === session.id} onSelect={setSelected} />
          ))}
        </div>
        {message ? <p className="mt-2 text-sm text-red-700">{message}</p> : null}
      </div>
      <p className="text-center text-sm text-[#4A3F66]">We&apos;ll add you to Arsh&apos;s calendar invite for you</p>
    </OnboardingFrame>
  );
}

function SessionCard({
  session,
  zone,
  selected,
  onSelect,
  large,
}: {
  session: SessionChoice;
  zone: string;
  selected: boolean;
  onSelect: (id: string) => void;
  large?: boolean;
}) {
  const yours = formatClockShort(session.startsAt, zone);
  const host = formatClockShort(session.startsAt, session.hostTimeZone);
  return (
    <button
      type="button"
      onClick={() => onSelect(session.id)}
      className={`min-h-11 w-full rounded-[20px] border-2 bg-white p-3 text-left active:scale-[0.99] ${selected ? "border-[#7C3AED]" : "border-transparent"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`font-heading font-extrabold ${large ? "text-xl" : "text-base"}`}>{yours}{large ? "" : " your time"}</p>
          {large ? <p className="text-sm font-semibold">{session.cardName}</p> : null}
          <p className="text-xs text-[#6B5F8A]">
            {large
              ? `UK session · next on ${formatWeekdayDate(session.startsAt, "Europe/London")}`
              : `${host} ${session.hostCity}${session.firstStartsOn ? ` · from ${formatStartDate(session.firstStartsOn)}` : ""}`}
          </p>
        </div>
        {selected ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7C3AED] text-xs text-white">✓</span> : null}
      </div>
    </button>
  );
}
