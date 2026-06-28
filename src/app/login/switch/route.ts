import { LAST_USER_COOKIE } from "@/lib/auth/last-user";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(LAST_USER_COOKIE);

  return NextResponse.redirect(new URL("/login", request.url));
}
