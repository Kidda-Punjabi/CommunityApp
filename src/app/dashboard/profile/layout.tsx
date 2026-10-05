import { isKidProfilePickerPath } from "@/lib/kids/constants";
import { kidHomeHref } from "@/lib/kids/load-kid-content";
import { loadKidSession } from "@/lib/kids/session";
import { planRedirect } from "@/lib/navigation/redirect-guard";
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
    const next = planRedirect({
      currentPath: pathname,
      destination: kidHomeHref(session.activeKidProfile.age_tier),
      redirectsAlreadyIssued: 0,
    });
    if (next) redirect(next);
  }

  return children;
}
