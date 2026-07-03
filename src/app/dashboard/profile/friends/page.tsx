import { FriendsDetail } from "@/components/profile/friends-detail";
import { loadFriendsProfileData } from "@/lib/friends/load-friends";
import { loadReferralProfileData } from "@/lib/referrals/load-referrals";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProfileFriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [friendsData, referralData] = await Promise.all([
    loadFriendsProfileData(supabase, user.id),
    loadReferralProfileData(supabase, user.id),
  ]);

  return (
    <FriendsDetail
      friends={friendsData.friends}
      requests={friendsData.requests}
      friendsUnavailable={friendsData.unavailable}
      shareUrl={referralData.shareUrl}
      referralCode={referralData.referralCode}
      referrals={referralData.referrals}
      unavailableReason={referralData.unavailableReason}
    />
  );
}
