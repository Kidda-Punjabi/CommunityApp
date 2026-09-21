"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { BackLink } from "@/components/navigation/back-link";
import { createClient } from "@/lib/supabase/client";
import { issueErrorMessage } from "@/lib/issues/error-message";
import { sanitizeIssueFilename } from "@/lib/issues/filename";
import {
  ISSUE_AREA_LABELS,
  ISSUE_AREAS,
  ISSUE_ATTACHMENTS_BUCKET,
  ISSUE_DESCRIPTION_MAX,
  ISSUE_RATE_LIMIT_MAX,
  ISSUE_RATE_LIMIT_MESSAGE,
  ISSUE_RATE_LIMIT_WINDOW_MS,
  type IssueArea,
  type IssueAttachment,
} from "@/lib/issues/types";
import {
  ISSUE_FILE_ACCEPT,
  formatFileSize,
  isImageMime,
  resolveIssueMimeType,
  validateIssueArea,
  validateIssueDescription,
  validateIssueFile,
  validateIssueFileCount,
} from "@/lib/issues/validation";
import { ui } from "@/lib/ui/styles";

type DraftFile = {
  key: string;
  file: File;
  name: string;
  mime: string;
  size: number;
  previewUrl: string | null;
  progress: "queued" | "uploading" | "done" | "error";
};

type ReportIssueFormProps = {
  fullName: string;
  email: string;
};

export function ReportIssueForm({ fullName, email }: ReportIssueFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<DraftFile[]>([]);

  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [areaTouched, setAreaTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [fileError, setFileError] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [pageUrl] = useState(() => {
    if (typeof window === "undefined") return "";
    const from = document.referrer?.trim();
    if (from && !from.includes("/dashboard/profile/report-issue")) return from;
    return `${window.location.origin}/dashboard/profile`;
  });

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const areaError = areaTouched || description.trim().length > 0 ? validateIssueArea(area) : null;
  const descriptionError =
    descriptionTouched || description.length > 0 ? validateIssueDescription(description) : null;
  const canSubmit =
    !pending && !validateIssueArea(area) && !validateIssueDescription(description);

  function clearFiles(next: DraftFile[]) {
    files.forEach((item) => {
      if (item.previewUrl && !next.some((keep) => keep.key === item.key)) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setFiles(next);
  }

  function onPickFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;

    setFileError("");
    const countError = validateIssueFileCount(files.length, picked.length);
    if (countError) {
      setFileError(countError);
      return;
    }

    const accepted: DraftFile[] = [];
    for (const file of picked) {
      const error = validateIssueFile(file);
      if (error) {
        setFileError(error);
        continue;
      }
      const mime = resolveIssueMimeType(file) ?? file.type;
      accepted.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        name: file.name,
        mime,
        size: file.size,
        previewUrl: isImageMime(mime) ? URL.createObjectURL(file) : null,
        progress: "queued",
      });
    }

    if (accepted.length > 0) {
      setFiles((prev) => [...prev, ...accepted].slice(0, 5));
    }
  }

  function removeFile(key: string) {
    clearFiles(files.filter((item) => item.key !== key));
    setFileError("");
  }

  async function countRecentReports(userId: string): Promise<number> {
    const since = new Date(Date.now() - ISSUE_RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error } = await supabase
      .from("issue_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if (error) throw error;
    return count ?? 0;
  }

  async function deleteUploaded(userId: string, reportId: string) {
    const folder = `${userId}/${reportId}`;
    const { data } = await supabase.storage.from(ISSUE_ATTACHMENTS_BUCKET).list(folder);
    const paths = (data ?? []).map((entry) => `${folder}/${entry.name}`);
    if (paths.length > 0) {
      await supabase.storage.from(ISSUE_ATTACHMENTS_BUCKET).remove(paths);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAreaTouched(true);
    setDescriptionTouched(true);
    setFormError("");

    const nextAreaError = validateIssueArea(area);
    const nextDescriptionError = validateIssueDescription(description);
    if (nextAreaError || nextDescriptionError) return;

    setPending(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You must be signed in.");

      const recent = await countRecentReports(user.id);
      if (recent >= ISSUE_RATE_LIMIT_MAX) {
        setFormError(ISSUE_RATE_LIMIT_MESSAGE);
        setPending(false);
        return;
      }

      const reportId = crypto.randomUUID();
      const usedNames = new Set<string>();
      const attachments: IssueAttachment[] = [];
      const uploadedPaths: string[] = [];

      try {
        for (const item of files) {
          setFiles((prev) =>
            prev.map((row) => (row.key === item.key ? { ...row, progress: "uploading" } : row))
          );
          const safeName = sanitizeIssueFilename(item.file.name, usedNames);
          const path = `${user.id}/${reportId}/${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from(ISSUE_ATTACHMENTS_BUCKET)
            .upload(path, item.file, {
              contentType: item.mime || item.file.type,
              upsert: false,
            });
          if (uploadError) {
            setFiles((prev) =>
              prev.map((row) => (row.key === item.key ? { ...row, progress: "error" } : row))
            );
            throw uploadError;
          }
          uploadedPaths.push(path);
          attachments.push({
            path,
            name: safeName,
            mime_type: item.mime || item.file.type,
            size: item.size,
          });
          setFiles((prev) =>
            prev.map((row) => (row.key === item.key ? { ...row, progress: "done" } : row))
          );
        }

        const { error: insertError } = await supabase.from("issue_reports").insert({
          id: reportId,
          user_id: user.id,
          kid_profile_id: null,
          area: area as IssueArea,
          description: description.trim(),
          full_name: fullName,
          email,
          page_url: pageUrl,
          user_agent: navigator.userAgent,
          attachments,
          status: "open",
        });
        if (insertError) throw insertError;
      } catch (error) {
        if (uploadedPaths.length > 0) {
          await deleteUploaded(user.id, reportId);
        }
        throw error;
      }

      try {
        await fetch("/api/issue-reports/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId }),
        });
      } catch {
        // Row is the source of truth — email failure is still success for the user.
      }

      files.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      setArea("");
      setDescription("");
      setFiles([]);
      setAreaTouched(false);
      setDescriptionTouched(false);
      setFileError("");
      setFormError("");
      setSuccessEmail(email);
    } catch (error) {
      setFormError(issueErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  if (successEmail) {
    return (
      <div className={`${ui.page} ${ui.stackLoose}`}>
        <div>
          <BackLink fallbackHref="/dashboard/profile" className="text-sm font-medium text-violet-600">
            ← Profile
          </BackLink>
          <h1 className="mt-3 text-2xl font-bold text-zinc-900">Thanks, we&apos;ve got your report</h1>
          <p className="mt-2 text-sm text-zinc-600">We&apos;ll reply to you at {successEmail}</p>
        </div>
        <Link href="/dashboard/profile" className={ui.btnPrimaryBlock}>
          Back to Profile
        </Link>
      </div>
    );
  }

  const remaining = ISSUE_DESCRIPTION_MAX - description.length;

  return (
    <div className={`${ui.page} ${ui.stackLoose}`}>
      <div>
        <BackLink fallbackHref="/dashboard/profile" className="text-sm font-medium text-violet-600">
          ← Profile
        </BackLink>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900">Report an issue</h1>
        <p className="mt-1 text-sm text-zinc-500">Tell us what went wrong and we&apos;ll take a look.</p>
      </div>

      <form onSubmit={handleSubmit} className={`${ui.card} space-y-5`}>
        <div>
          <label htmlFor="issue-area" className="block text-sm font-medium text-zinc-700">
            Area
          </label>
          <select
            id="issue-area"
            value={area}
            onChange={(event) => setArea(event.target.value)}
            onBlur={() => setAreaTouched(true)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            required
          >
            <option value="">Select an area</option>
            {ISSUE_AREAS.map((value) => (
              <option key={value} value={value}>
                {ISSUE_AREA_LABELS[value]}
              </option>
            ))}
          </select>
          {areaError ? <p className="mt-1.5 text-sm text-red-600">{areaError}</p> : null}
        </div>

        <div>
          <label htmlFor="issue-description" className="block text-sm font-medium text-zinc-700">
            Description
          </label>
          <textarea
            id="issue-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => setDescriptionTouched(true)}
            rows={6}
            maxLength={ISSUE_DESCRIPTION_MAX}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            placeholder="What happened? Include anything that would help us reproduce it."
          />
          <div className="mt-1.5 flex items-start justify-between gap-3">
            {descriptionError ? (
              <p className="text-sm text-red-600">{descriptionError}</p>
            ) : (
              <span />
            )}
            <p
              className={`shrink-0 text-xs tabular-nums ${
                remaining <= 200 ? "font-medium text-amber-700" : "text-zinc-400"
              }`}
            >
              {description.length} / {ISSUE_DESCRIPTION_MAX}
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-700">Attachments</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Up to 5 files. Images and PDFs up to 10 MB, screen recordings up to 50 MB.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ISSUE_FILE_ACCEPT}
            multiple
            className="sr-only"
            onChange={onPickFiles}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending || files.length >= 5}
            className={`mt-2 ${ui.btnSecondary}`}
          >
            Add files
          </button>
          {fileError ? <p className="mt-1.5 text-sm text-red-600">{fileError}</p> : null}

          {files.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {files.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                >
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.previewUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-zinc-500">
                      {item.mime === "application/pdf" ? "PDF" : "FILE"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                    <p className="text-xs text-zinc-500">
                      {formatFileSize(item.size)}
                      {item.progress === "uploading" ? " · Uploading…" : null}
                      {item.progress === "error" ? " · Upload failed" : null}
                    </p>
                  </div>
                  {item.progress === "uploading" ? (
                    <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeFile(item.key)}
                      disabled={pending}
                      className="text-sm font-semibold text-zinc-500 hover:text-zinc-800"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

        <button type="submit" disabled={!canSubmit} className={ui.btnPrimaryBlock}>
          {pending ? "Sending…" : "Send report"}
        </button>
      </form>
    </div>
  );
}
