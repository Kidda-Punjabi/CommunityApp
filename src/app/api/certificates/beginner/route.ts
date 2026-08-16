import { NextResponse } from "next/server";
import { buildCertificatePdf, certificatePdfFileName } from "@/lib/learn/certificate-pdf";
import { loadBeginnerCertificateAward } from "@/lib/learn/certificate-student";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const award = await loadBeginnerCertificateAward(supabase, user);
  const bytes = await buildCertificatePdf(award);
  const fileName = certificatePdfFileName(award.studentName, award.courseTitle);
  const download = new URL(request.url).searchParams.get("download") === "1";

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
