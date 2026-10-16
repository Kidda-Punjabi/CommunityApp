"use server";

import { deleteCurrentAccount } from "@/lib/account/delete-account";
import { redirect } from "next/navigation";

export type DeleteAccountState = {
  error?: string;
};

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const confirmation = String(formData.get("confirmation") ?? "");
  const result = await deleteCurrentAccount(confirmation);
  if (result.error) return { error: result.error };
  redirect("/login?message=Your%20account%20has%20been%20deleted.");
}
