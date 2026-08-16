import { isKidProfilePickerPath } from "@/lib/kids/constants";
import { kidHomeHref } from "@/lib/kids/load-kid-content";
import { loadKidSession } from "@/lib/kids/session";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProfileSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  // Empty pathname: fail open so a missing x-pathname cannot bounce the picker.
  const isProfileSwitcher = !pathname || isKidProfilePickerPath(pathname);

  const session = await loadKidSession(user.id);
  if (session.activeKidProfile && !isProfileSwitcher) {
    redirect(kidHomeHref(session.activeKidProfile.age_tier));
  }

  return children;
}
