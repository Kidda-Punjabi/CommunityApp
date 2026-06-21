import { UserAvatar } from "@/components/profile/user-avatar";
import type { CourseStaffMember, MyTutorInfo } from "@/lib/tutoring/load-course-staff";
import { ui } from "@/lib/ui/styles";

type MyTutorSectionProps = {
  tutorInfo: MyTutorInfo;
};

export function MyTutorSection({ tutorInfo }: MyTutorSectionProps) {
  return (
    <div className={`${ui.cardBordered} mb-6`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
        My tutor
      </p>

      {tutorInfo.assigned && tutorInfo.tutor ? (
        <div className="mt-3 flex items-center gap-4">
          <UserAvatar
            profile={{
              full_name: tutorInfo.tutor.displayName,
              preferred_name: null,
              avatar_url: tutorInfo.tutor.avatarUrl,
            }}
            size="md"
          />
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900">{tutorInfo.tutor.displayName}</p>
            {tutorInfo.deliveryMode === "group" && tutorInfo.cohortName ? (
              <p className="mt-0.5 text-sm text-zinc-500">
                Group class · {tutorInfo.cohortName}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-zinc-500">1-1 tutoring</p>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">
          Your tutor will be assigned soon. You can browse this course in the meantime — lesson
          content unlocks once your tutor is ready.
        </p>
      )}
    </div>
  );
}

type CommunityLeadSectionProps = {
  leads: CourseStaffMember[];
};

export function CommunityLeadSection({ leads }: CommunityLeadSectionProps) {
  return (
    <div className={`${ui.cardBordered} mb-6`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
        Your community lead{leads.length > 1 ? "s" : ""}
      </p>

      {leads.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">
          Your community lead will be listed here soon.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {leads.map((lead) => (
            <li key={lead.userId} className="flex items-center gap-4">
              <UserAvatar
                profile={{
                  full_name: lead.displayName,
                  preferred_name: null,
                  avatar_url: lead.avatarUrl,
                }}
                size="md"
              />
              <p className="font-semibold text-zinc-900">{lead.displayName}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
