import { LockedCertificateRow } from "@/components/learn/locked-certificate-row";
import { BackLink } from "@/components/navigation/back-link";
import { NavLink } from "@/components/ui/nav-link";
import { resolveCourseActor } from "@/lib/kids/course-actor";
import {
  CERTIFICATE_FORMAT_FOOTNOTE,
  certificatesForLearnActor,
} from "@/lib/learn/certificate-mock";
import { fetchAccessibleKidsCourses, kidsCourseLearnPath } from "@/lib/learning/kids-courses";
import { pressableClass } from "@/lib/ui/pressable";
import { cn, ui } from "@/lib/ui/styles";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { redirect } from "next/navigation";

const STATUS_LABEL: Record<string, string> = {
  earned: "Earned",
  in_progress: "In progress",
  locked: "Locked",
};

export default async function CertificatesPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { supabase, user } = session;
  const [actor, kidsCourses] = await Promise.all([
    resolveCourseActor(supabase, user.id),
    fetchAccessibleKidsCourses(supabase, user.id),
  ]);

  const certificates = certificatesForLearnActor({
    isKid: actor.kind === "kid",
    kidsCourseHref: kidsCourses[0] ? kidsCourseLearnPath(kidsCourses[0].id) : null,
  });

  return (
    <div className={ui.page}>
      <BackLink href="/dashboard/learn">← Back to Home</BackLink>
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Certificates</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Track the certificates you can earn as you move through Kidda courses.
        </p>
      </div>

      <div className="space-y-3">
        {certificates.map((cert) => {
          if (cert.status === "locked") {
            return (
              <LockedCertificateRow
                key={cert.id}
                title={cert.title}
                cefr={cert.cefr}
                hint={cert.lockedHint ?? ""}
              />
            );
          }

          return (
            <NavLink
              key={cert.id}
              href={cert.href ?? "/dashboard/learn"}
              className={cn(
                pressableClass,
                "block rounded-3xl border border-zinc-200/70 bg-white p-4 shadow-[0_2px_16px_-4px_rgba(24,24,27,0.07)] hover:border-violet-200"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-base font-semibold text-zinc-900">{cert.title}</p>
                  <p className="mt-0.5 text-xs font-medium text-zinc-500">CEFR {cert.cefr}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    cert.status === "earned"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  )}
                >
                  {STATUS_LABEL[cert.status]}
                </span>
              </div>
              {cert.awardedOn ? (
                <p className="mt-3 text-xs text-zinc-500">Awarded {cert.awardedOn}</p>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">Continue your current course to unlock this.</p>
              )}
            </NavLink>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-zinc-500">
        {CERTIFICATE_FORMAT_FOOTNOTE}
      </p>
    </div>
  );
}
