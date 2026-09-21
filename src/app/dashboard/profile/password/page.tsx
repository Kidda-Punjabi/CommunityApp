import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <ChangePasswordForm />;
}
