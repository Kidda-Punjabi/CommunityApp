import { ADMIN_HELP } from "@/lib/help/content-admin";
import { STUDENT_HELP } from "@/lib/help/content-student";
import { TUTOR_HELP } from "@/lib/help/content-tutor";
import type { HelpAudience, HelpContent } from "@/lib/help/types";

const BY_AUDIENCE: Record<HelpAudience, HelpContent> = {
  student: STUDENT_HELP,
  tutor: TUTOR_HELP,
  admin: ADMIN_HELP,
};

export function getHelpContent(audience: HelpAudience): HelpContent {
  return BY_AUDIENCE[audience];
}

export function getHelpBackHref(audience: HelpAudience): string {
  switch (audience) {
    case "student":
      return "/dashboard/profile";
    case "tutor":
      return "/dashboard/tutor/profile";
    case "admin":
      return "/admin/content";
  }
}
