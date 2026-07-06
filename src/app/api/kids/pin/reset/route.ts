import { NextResponse } from "next/server";
import { hashKidsPin, isValidPin } from "@/lib/kids/pin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email, password, newPin, confirmNewPin } = (await request.json()) as {
    email?: string;
    password?: string;
    newPin?: string;
    confirmNewPin?: string;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!email || !password || !isValidPin(newPin ?? "") || newPin !== confirmNewPin) {
    return NextResponse.json({ error: "Invalid reset request." }, { status: 400 });
  }

  if (email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json({ error: "Email does not match your account." }, { status: 403 });
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.json({ error: "Password incorrect." }, { status: 403 });
  }

  const kids_pin_hash = await hashKidsPin(newPin!);
  const { error } = await supabase.from("profiles").update({ kids_pin_hash }).eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
