"use client";

import { getTimeAwareGreeting } from "@/lib/profile/greeting";

type HomeGreetingHeadingProps = {
  displayName: string | null;
};

export function HomeGreetingHeading({ displayName }: HomeGreetingHeadingProps) {
  const hour = new Date().getHours();
  const greeting = getTimeAwareGreeting(displayName, hour);

  return (
    <h1 className="font-heading text-2xl font-bold leading-tight tracking-tight text-zinc-900">
      {greeting}
    </h1>
  );
}
