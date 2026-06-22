"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/profile/user-avatar";
import { uploadAvatar } from "@/lib/profile/upload-avatar";
import type { ProfileNameFields } from "@/lib/profile/display-name";
import { updateAvatarUrl, updateProfile, type ProfileActionState } from "../actions";
import { ui } from "@/lib/ui/styles";

type EditProfileFormProps = {
  userId: string;
  profile: ProfileNameFields & { avatar_url?: string | null };
  learnerLevel?: number | null;
};

const initialState: ProfileActionState = {};

export function EditProfileForm({ userId, profile, learnerLevel }: EditProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [preferredName, setPreferredName] = useState(profile.preferred_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const hadFullName = Boolean(profile.full_name?.trim());

  useEffect(() => {
    setFullName(profile.full_name ?? "");
    setPreferredName(profile.preferred_name ?? "");
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile.full_name, profile.preferred_name, profile.avatar_url]);

  useEffect(() => {
    if (!state.success) return;
    if (state.profile) {
      setFullName(state.profile.full_name ?? "");
      setPreferredName(state.profile.preferred_name ?? "");
    }
    router.refresh();
  }, [state.success, state.profile, router]);

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    try {
      const url = await uploadAvatar(userId, file);
      const result = await updateAvatarUrl(url);
      if (result.error) {
        setUploadError(result.error);
        return;
      }
      setAvatarUrl(url);
      router.refresh();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="had_full_name" value={hadFullName ? "true" : "false"} />

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative transition-opacity hover:opacity-90 disabled:opacity-60"
          aria-label="Upload profile photo"
        >
          <UserAvatar
            profile={{ full_name: fullName, preferred_name: preferredName, avatar_url: avatarUrl }}
            level={learnerLevel}
            size="lg"
            className="shadow-sm ring-4 ring-white"
          />
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleAvatarChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm font-semibold text-violet-600 hover:text-violet-500 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload photo"}
        </button>
        {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
        <p className="text-center text-xs text-zinc-500">JPG, PNG, or WebP · max 5 MB</p>
      </div>

      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-zinc-700">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className={`mt-1.5 ${ui.input}`}
          placeholder="Jane Doe"
        />
      </div>

      <div>
        <label htmlFor="preferred_name" className="block text-sm font-medium text-zinc-700">
          Preferred name <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          This is what we&apos;ll call you in the app, instead of your full name.
        </p>
        <input
          id="preferred_name"
          name="preferred_name"
          type="text"
          autoComplete="nickname"
          value={preferredName}
          onChange={(event) => setPreferredName(event.target.value)}
          className={`mt-1.5 ${ui.input}`}
          placeholder="Gigi"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          <span aria-hidden="true">✓</span> Profile saved
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={ui.btnPrimaryBlock}
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
