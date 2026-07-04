"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/profile/user-avatar";
import { uploadAvatar } from "@/lib/profile/upload-avatar";
import type { ProfileNameFields } from "@/lib/profile/display-name";
import {
  updateTutorAvatarUrl,
  updateTutorBio,
  type TutorProfileActionState,
} from "../actions";
import { ui } from "@/lib/ui/styles";

type TutorProfileEditFormProps = {
  userId: string;
  profile: ProfileNameFields & {
    avatar_url?: string | null;
    tutor_bio?: string | null;
  };
};

const initialState: TutorProfileActionState = {};

export function TutorProfileEditForm({ userId, profile }: TutorProfileEditFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bioState, bioAction, bioPending] = useActionState(updateTutorBio, initialState);
  const [bio, setBio] = useState(profile.tutor_bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setBio(profile.tutor_bio ?? "");
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile.tutor_bio, profile.avatar_url]);

  useEffect(() => {
    if (!bioState.success) return;
    if (bioState.tutorBio !== undefined) {
      setBio(bioState.tutorBio ?? "");
    }
    router.refresh();
  }, [bioState.success, bioState.tutorBio, router]);

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    try {
      const url = await uploadAvatar(userId, file);
      const result = await updateTutorAvatarUrl(url);
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
    <div className="space-y-10">
      <section id="photo" className="scroll-mt-24">
        <h2 className="text-lg font-semibold text-zinc-900">Profile photo</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Upload a clear photo of yourself — students see this when booking lessons.
        </p>

        <div className="mt-5 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative transition-opacity hover:opacity-90 disabled:opacity-60"
            aria-label="Upload profile photo"
          >
            <UserAvatar
              profile={{
                full_name: profile.full_name,
                preferred_name: profile.preferred_name,
                avatar_url: avatarUrl,
              }}
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
      </section>

      <section id="bio" className="scroll-mt-24">
        <h2 className="text-lg font-semibold text-zinc-900">Short bio</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Share a little about yourself and your interests outside of teaching Punjabi — keep it
          personal and friendly.
        </p>

        <form action={bioAction} className="mt-5 space-y-4">
          <textarea
            id="tutor_bio"
            name="tutor_bio"
            rows={5}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="e.g. I love cooking Punjabi food on weekends and hiking in the Lake District…"
            className="block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
          {bioState.error && <p className="text-sm text-red-600">{bioState.error}</p>}
          {bioState.success && (
            <p className="text-sm text-emerald-700">Bio saved.</p>
          )}
          <button type="submit" disabled={bioPending} className={ui.btnPrimary}>
            {bioPending ? "Saving…" : "Save bio"}
          </button>
        </form>
      </section>
    </div>
  );
}
