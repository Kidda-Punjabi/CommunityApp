export type PremiumMembershipSnapshot = {
  id: string;
  userId: string;
  stripeSubscriptionId: string | null;
  status: string;
};

export type PremiumWritePlan =
  | { action: "update"; membershipId: string }
  | { action: "insert" }
  | {
      action: "duplicate";
      existingSubscriptionId: string;
      incomingSubscriptionId: string;
    };

const BLOCKING_STATUSES = new Set(["active", "trialing"]);

/**
 * One premium row per user.
 * A second live subscription is a duplicate and must not overwrite the first.
 * A cancelled or otherwise inactive row is replaced (resubscribe).
 */
export function planPremiumMembershipWrite(params: {
  userId: string;
  subscriptionId: string;
  subscriptionRow: PremiumMembershipSnapshot | null;
  userPremiumRows: PremiumMembershipSnapshot[];
}): PremiumWritePlan {
  const sameSubscription = params.subscriptionRow;
  if (sameSubscription) {
    if (sameSubscription.userId !== params.userId) {
      return {
        action: "duplicate",
        existingSubscriptionId:
          sameSubscription.stripeSubscriptionId ?? params.subscriptionId,
        incomingSubscriptionId: params.subscriptionId,
      };
    }
    return { action: "update", membershipId: sameSubscription.id };
  }

  const blocking = params.userPremiumRows.find(
    (row) =>
      BLOCKING_STATUSES.has(row.status) &&
      row.stripeSubscriptionId !== params.subscriptionId
  );
  if (blocking) {
    return {
      action: "duplicate",
      existingSubscriptionId: blocking.stripeSubscriptionId ?? "(none)",
      incomingSubscriptionId: params.subscriptionId,
    };
  }

  const replaceable = params.userPremiumRows.find(
    (row) => !BLOCKING_STATUSES.has(row.status)
  );
  if (replaceable) return { action: "update", membershipId: replaceable.id };

  return { action: "insert" };
}

export function duplicateSubscriptionMessage(
  existingSubscriptionId: string,
  incomingSubscriptionId: string
): string {
  return `already has ${existingSubscriptionId}, not applying ${incomingSubscriptionId}`;
}

export function awaitingCheckoutMessage(subscriptionId: string): string {
  return `awaiting checkout resolution, sub ${subscriptionId}`;
}

export function unmatchedCheckoutMessage(
  email: string | null,
  subscriptionId: string | null
): string {
  return `no app user for ${email ?? "unknown email"}, sub ${subscriptionId ?? "unknown"}`;
}
