/**
 * TODO(certificates-backend): replace this mock with a `certificates` /
 * `badges` table and real award dates. This pass is layout only — do not
 * treat "Earned" / "In progress" as live student data.
 */
export type MockCertificateStatus = "earned" | "in_progress" | "locked";

export type MockCertificateLevel = "beginner" | "intermediate" | "advanced";

export type MockCertificate = {
  id: MockCertificateLevel;
  title: string;
  cefr: string;
  status: MockCertificateStatus;
  awardedOn: string | null;
  lockedHint: string | null;
  href: string | null;
};

export const MOCK_CERTIFICATES: MockCertificate[] = [
  {
    id: "beginner",
    title: "Beginner",
    cefr: "A2",
    status: "earned",
    awardedOn: "12 March 2026",
    lockedHint: null,
    href: "/dashboard/learn/certificates/beginner",
  },
  {
    id: "intermediate",
    title: "Intermediate",
    cefr: "B1",
    status: "in_progress",
    awardedOn: null,
    lockedHint: null,
    // Reuse the existing Beginner course progress / lesson list.
    href: "/dashboard/learn/beginners",
  },
  {
    id: "advanced",
    title: "Advanced",
    cefr: "B2",
    status: "locked",
    awardedOn: null,
    lockedHint: "Unlocks after Intermediate certificate",
    href: null,
  },
];

export const MOCK_BEGINNER_CERTIFICATE = MOCK_CERTIFICATES[0];

export const CERTIFICATE_FORMAT_FOOTNOTE =
  "The same Kidda certificate is awarded whether you learn as an adult or a child, in a group or 1-to-1.";

export const CERTIFICATE_CEFR_DISCLAIMER =
  "This certificate reflects Kidda's own assessment, aligned with CEFR A2 descriptors. It is not an accredited external qualification.";

/** Same certificate ladder for kids; in-progress links to their class, not adult Beginners. */
export function certificatesForLearnActor(options: {
  isKid: boolean;
  kidsCourseHref: string | null;
}): MockCertificate[] {
  if (!options.isKid) return MOCK_CERTIFICATES;

  return MOCK_CERTIFICATES.map((cert) => {
    if (cert.id !== "intermediate") return cert;
    return {
      ...cert,
      href: options.kidsCourseHref ?? "/dashboard/learn",
    };
  });
}
