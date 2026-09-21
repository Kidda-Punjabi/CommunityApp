"use client";

import { useState } from "react";
import Link from "next/link";
import { BookCallSheet } from "@/components/profile/book-call-sheet";
import { useKidSession } from "@/components/kids/kid-session-provider";
import {
  AccountListRow,
  HubCard,
} from "@/components/ui/hub-primitives";

type AccountCardProps = {
  isFreeOnly: boolean;
};

export function AccountCard({ isFreeOnly }: AccountCardProps) {
  const [bookCallOpen, setBookCallOpen] = useState(false);
  const { activeKidProfile } = useKidSession();
  const showChangePassword = activeKidProfile === null;

  return (
    <>
      <HubCard>
        <div className="divide-y divide-zinc-100">
          <AccountListRow href="/dashboard/membership/premium" label="Kidda Premium" />
          <AccountListRow href="/dashboard/profile/billing" label="Billing and purchases" />
          <AccountListRow
            href="/courses"
            label={isFreeOnly ? "Browse courses" : "Buy another course"}
          />
          <AccountListRow href="/dashboard/profile/sound" label="Sound effects" />
          <AccountListRow href="/dashboard/profile/kids/manage" label="Manage kid profiles & PIN" />
          <AccountListRow href="/dashboard/profile/feedback" label="Share lesson feedback" />
          <AccountListRow href="/dashboard/profile/help" label="Help Centre" />
          <AccountListRow
            label="Book a call with the team"
            onClick={() => setBookCallOpen(true)}
          />
          <AccountListRow href="/dashboard/profile/notifications" label="Notification settings" />
          {showChangePassword ? (
            <AccountListRow href="/dashboard/profile/password" label="Change password" />
          ) : null}
        </div>
      </HubCard>
      <BookCallSheet open={bookCallOpen} onClose={() => setBookCallOpen(false)} />
    </>
  );
}
