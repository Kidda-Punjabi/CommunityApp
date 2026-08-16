import { CertificatePdfPanel } from "@/components/learn/certificate-pdf-panel";
import { BackLink } from "@/components/navigation/back-link";
import { MOCK_BEGINNER_CERTIFICATE, CERTIFICATE_CEFR_DISCLAIMER } from "@/lib/learn/certificate-mock";
import { certificatePdfFileName } from "@/lib/learn/certificate-pdf";
import { loadCertificateStudentName } from "@/lib/learn/certificate-student";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function BeginnerCertificatePage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { supabase, user } = session;
  const studentName = await loadCertificateStudentName(supabase, user);
  const cert = MOCK_BEGINNER_CERTIFICATE;
  const fileName = certificatePdfFileName(studentName, cert.title);

  return (
    <div className={ui.page}>
      <BackLink href="/dashboard/learn/certificates">← Certificates</BackLink>

      <div className="mb-2 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {cert.title} certificate
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Awarded to {studentName}
          {cert.awardedOn ? ` · ${cert.awardedOn}` : ""}
        </p>
      </div>

      <CertificatePdfPanel
        fileName={fileName}
        shareTitle={`Kidda ${cert.title} Certificate`}
      />

      <p className="mt-8 text-center text-[11px] leading-relaxed text-zinc-500">
        {CERTIFICATE_CEFR_DISCLAIMER}
      </p>
    </div>
  );
}
