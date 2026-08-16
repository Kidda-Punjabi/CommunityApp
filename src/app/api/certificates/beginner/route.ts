import { NextResponse } from "next/server";
import { MOCK_BEGINNER_CERTIFICATE } from "@/lib/learn/certificate-mock";
import { buildCertificatePdf, certificatePdfFileName } from "@/lib/learn/certificate-pdf";
import { loadCertificateStudentName } from "@/lib/learn/certificate-student";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const studentName = await loadCertificateStudentName(supabase, user);
  const cert = MOCK_BEGINNER_CERTIFICATE;
  const bytes = await buildCertificatePdf({
    studentName,
    courseTitle: cert.title,
    cefr: cert.cefr,
    awardedOn: cert.awardedOn ?? "",
  });
  const fileName = certificatePdfFileName(studentName, cert.title);
  const download = new URL(request.url).searchParams.get("download") === "1";

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
