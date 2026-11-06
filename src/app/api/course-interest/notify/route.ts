import { NextResponse, after } from "next/server";
import { sendCourseInterestNotifyEmail } from "@/lib/email/send-course-interest-notify";
import {
  courseInterestPipelineName,
  createCourseInterestOpportunity,
} from "@/lib/ghl/course-interest-opportunity";
import { resolveCourseActor } from "@/lib/kids/course-actor";
import { isComingSoonCourseLevel, type ComingSoonCourseLevel } from "@/lib/learn/course-interest";
import { LEARN_COURSE_LEVELS } from "@/lib/learn/course-levels";
import {
  courseInterestTimelineLabel,
  isCourseInterestTimeline,
  isHotCourseInterest,
} from "@/lib/learn/course-interest-timeline";
import { getDisplayName } from "@/lib/profile/display-name";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function courseTitleFor(level: ComingSoonCourseLevel): string {
  if (level === "kids_intermediate") return "Kids Intermediate";
  if (level === "kids_advanced") return "Kids Advanced";
  return LEARN_COURSE_LEVELS[level]?.title ?? level;
}

/**
 * Called once the "When would you like to start?" pop-up closes (answered,
 * skipped, dismissed, or the page left). Saves the answer, then tells the team
 * exactly once per signup: a GHL opportunity plus an email to Adnan.
 */
export async function POST(request: Request) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  let courseLevel = "";
  let timeline: string | null = null;
  try {
    const body = (await request.json()) as { courseLevel?: unknown; timeline?: unknown };
    courseLevel = typeof body.courseLevel === "string" ? body.courseLevel : "";
    timeline = isCourseInterestTimeline(body.timeline) ? body.timeline : null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!isComingSoonCourseLevel(courseLevel)) {
    return NextResponse.json({ error: "Unknown course." }, { status: 400 });
  }
  const level = courseLevel;

  const actor = await resolveCourseActor(auth, user.id);
  const admin = createServiceRoleClient();

  const lookup = admin
    .from("course_interest_signups")
    .select("id, created_at, start_timeline, team_notified_at")
    .eq("course_level", level);
  const { data: signup } =
    actor.kind === "kid"
      ? await lookup.eq("kid_profile_id", actor.kidProfileId).maybeSingle()
      : await lookup.eq("user_id", user.id).maybeSingle();
  if (!signup) return NextResponse.json({ error: "No interest found." }, { status: 404 });

  // Claim the notification so a double close or a second tab can't send twice.
  const { data: claimed } = await admin
    .from("course_interest_signups")
    .update({
      team_notified_at: new Date().toISOString(),
      ...(timeline ? { start_timeline: timeline } : {}),
    })
    .eq("id", signup.id)
    .is("team_notified_at", null)
    .select("id")
    .maybeSingle();

  if (!claimed) {
    if (timeline && !signup.start_timeline) {
      await admin
        .from("course_interest_signups")
        .update({ start_timeline: timeline })
        .eq("id", signup.id);
    }
    return NextResponse.json({ ok: true, alreadyNotified: true });
  }

  const signupId = signup.id as string;
  const registeredAt = signup.created_at as string;

  after(async () => {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, preferred_name")
      .eq("id", user.id)
      .maybeSingle();
    let kidName: string | null = null;
    if (actor.kind === "kid") {
      const { data: kid } = await admin
        .from("kid_profiles")
        .select("name")
        .eq("id", actor.kidProfileId)
        .maybeSingle();
      kidName = (kid?.name as string | undefined)?.trim() || null;
    }

    const email = user.email?.trim().toLowerCase() || null;
    const fullName =
      (profile?.full_name as string | undefined)?.trim() || getDisplayName(profile ?? null) || email || "Kidda member";
    const courseTitle = courseTitleFor(level);
    const timelineLabel = courseInterestTimelineLabel(timeline);

    let ghlStatus = "Not created (no email on file)";
    if (email) {
      try {
        const result = await createCourseInterestOpportunity({
          level,
          email,
          fullName: kidName ? `${fullName} (for ${kidName})` : fullName,
          courseTitle,
          timelineLabel,
        });
        ghlStatus = result.created ? "New opportunity created" : "Already had an open opportunity";
        if (result.opportunityId) {
          await admin
            .from("course_interest_signups")
            .update({ ghl_opportunity_id: result.opportunityId })
            .eq("id", signupId);
        }
      } catch (error) {
        console.error("[course-interest] GHL opportunity failed", error);
        ghlStatus = "Could not create, please add by hand";
      }
    }

    const sent = await sendCourseInterestNotifyEmail({
      fullName,
      email,
      courseTitle,
      timelineLabel,
      hot: isHotCourseInterest(timeline),
      kidName,
      pipelineName: courseInterestPipelineName(level),
      ghlStatus,
      registeredAt,
    });
    if (sent.error) console.error("[course-interest] email failed", sent.error);
  });

  return NextResponse.json({ ok: true });
}
