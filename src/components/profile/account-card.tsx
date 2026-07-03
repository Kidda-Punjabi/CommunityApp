"use client";

import { useState } from "react";
import Link from "next/link";
import { BookCallSheet } from "@/components/profile/book-call-sheet";
import {
  AccountListRow,
  EyebrowLabel,
  HubCard,
} from "@/components/ui/hub-primitives";

type AccountCardProps = {
  membershipLabel: string;
  isFreeOnly: boolean;
};

export function AccountCard({ membershipLabel, isFreeOnly }: AccountCardProps) {
  const [bookCallOpen, setBookCallOpen] = useState(false);

  return (
    <>
      <HubCard>
        <EyebrowLabel>Account</EyebrowLabel>
        <p className="mt-1 text-sm font-medium text-zinc-900">{membershipLabel}</p>
        <div className="mt-2 divide-y divide-zinc-100 border-t border-zinc-100">
          <AccountListRow href="/dashboard/profile/billing" label="Billing and purchases" />
          <AccountListRow
            href="/courses"
            label={isFreeOnly ? "Browse courses" : "Buy another course"}
          />
          <AccountListRow href="/dashboard/profile/help" label="Help articles" />
          <AccountListRow
            label="Book a call with the team"
            onClick={() => setBookCallOpen(true)}
          />
          <AccountListRow href="/dashboard/profile/notifications" label="Notification settings" />
        </div>
      </HubCard>
      <BookCallSheet open={bookCallOpen} onClose={() => setBookCallOpen(false)} />
    </>
  );
}
