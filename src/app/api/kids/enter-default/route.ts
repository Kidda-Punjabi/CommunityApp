import { NextResponse } from "next/server";
import { kidHomeHref } from "@/lib/kids/load-kid-content";
import { loadParentEntryFacts } from "@/lib/kids/load-parent-entry";
import { decideParentEntry } from "@/lib/kids/parent-entry";
import { KID_PROFILE_COOKIE, KID_PROFILE_PICKER_PATH, WHO_IS_LEARNING_COOKIE } from "@/lib/kids/constants";
import {
  hasPickedWhoThisSession,
  kidProfileCookieOptions,
  kidsPinUnlockedCookieOptions,
  syncKidSessionContext,
} from "@/lib/kids/session";
import { createClient } from "@/lib/supabase/server";

/** One-kid parents with no adult course: set the kid session and open their home. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const facts = await loadParentEntryFacts(supabase, user.id);
  const decision = decideParentEntry({
    kidCount: facts.kidCount,
    hasOwnAdultCourse: facts.hasOwnAdultCourse,
    pickedWhoThisSession: await hasPickedWhoThisSession(),
    activeKidProfileId: null,
    viewAsActive: false,
  });

  if (decision === "picker") {
    return NextResponse.redirect(new URL(KID_PROFILE_PICKER_PATH, request.url));
  }

  if (decision !== "enter-kid" || !facts.soleKid) {
    return NextResponse.redirect(new URL("/dashboard/learn", request.url));
  }

  await syncKidSessionContext(user.id, facts.soleKid.id);
  const response = NextResponse.redirect(new URL(kidHomeHref(facts.soleKid.ageTier), request.url));
  response.cookies.set(KID_PROFILE_COOKIE, facts.soleKid.id, kidProfileCookieOptions());
  response.cookies.set(WHO_IS_LEARNING_COOKIE, "1", kidsPinUnlockedCookieOptions());
  return response;
}
