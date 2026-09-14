import { activateKidProfileSession } from "@/lib/kids/session";
import { kidsCourseLearnPath } from "@/lib/learning/kids-courses";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ kidProfileId: string }> };

/**
 * Cookie writes are illegal in the detail page Server Component (digest 44264486).
 * This Route Handler is the allowed place to switch into the child, then send
 * them to the kids course home.
 */
export async function GET(request: Request, context: RouteContext) {
  const { kidProfileId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: kid } = await supabase
    .from("kid_profiles")
    .select("id")
    .eq("id", kidProfileId)
    .eq("parent_user_id", user.id)
    .maybeSingle();
  if (!kid?.id) {
    return NextResponse.redirect(new URL("/dashboard/learn/kids-progress", request.url));
  }

  await activateKidProfileSession(user.id, kidProfileId);

  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("course_id")
    .eq("kid_profile_id", kidProfileId)
    .not("course_id", "is", null)
    .limit(1)
    .maybeSingle();

  const courseId = (enrollment?.course_id as string | null) ?? null;
  const dest = courseId
    ? kidsCourseLearnPath(courseId)
    : `/dashboard/learn/kids-progress/${kidProfileId}`;
  return NextResponse.redirect(new URL(dest, request.url));
}
