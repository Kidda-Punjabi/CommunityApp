const PRIVATE_USER_UPLOAD_BUCKETS = new Set([
  "avatars",
  "profile-photos",
  "feedback-photos",
  "lesson-log-media",
]);

export { PRIVATE_USER_UPLOAD_BUCKETS };

export const LESSON_LOG_MEDIA_BUCKET = "lesson-log-media";

const AVATAR_OBJECT_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/profile\.(jpg|png|webp)$/i;

function cacheQuery(value: string): { base: string; query: string } {
  const hash = value.indexOf("#");
  const withoutHash = hash === -1 ? value : value.slice(0, hash);
  const queryIndex = withoutHash.indexOf("?");
  if (queryIndex === -1) return { base: withoutHash, query: "" };
  return {
    base: withoutHash.slice(0, queryIndex),
    query: withoutHash.slice(queryIndex),
  };
}

function proxyPath(bucket: string, objectPath: string): string {
  return `/api/media/${encodeURIComponent(bucket)}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/** Storage object path for an avatar, from a bare path or a legacy public URL. */
export function avatarObjectPath(value: string): string | null {
  const { base } = cacheQuery(value.trim());
  if (!base || base.includes("..")) return null;

  const parsed = parsePublicStorageUrl(base);
  const path = parsed
    ? parsed.bucket === "avatars"
      ? parsed.path
      : null
    : base.replace(/^\/+/, "");

  if (!path || !AVATAR_OBJECT_PATH.test(path)) return null;
  return path;
}

export function avatarObjectPathForUser(userId: string, value: string): string | null {
  const path = avatarObjectPath(value);
  if (!path?.startsWith(`${userId}/`)) return null;
  return path;
}

/** Append a cache-buster for the uploader's own preview. Do not persist this. */
export function withAvatarCacheBust(path: string): string {
  const { base } = cacheQuery(path);
  return `${base}?v=${Date.now()}`;
}

/** Keep a just-uploaded cache-buster when a refresh returns the same stored path. */
export function retainAvatarCacheBust(
  current: string | null,
  next: string | null
): string | null {
  if (!next) return null;
  if (current?.includes("?v=")) {
    const currentBase = cacheQuery(current).base;
    const nextBase = cacheQuery(next).base;
    if (currentBase === nextBase) return current;
  }
  return next;
}

/** Rewrite a stored avatar path or private Storage URL to the signed-media proxy. */
export function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const { base, query } = cacheQuery(trimmed);
  const parsed = parsePublicStorageUrl(base);
  if (parsed) {
    if (!PRIVATE_USER_UPLOAD_BUCKETS.has(parsed.bucket)) return url;
    return `${proxyPath(parsed.bucket, parsed.path)}${query}`;
  }

  const avatarPath = avatarObjectPath(base);
  if (avatarPath) return `${proxyPath("avatars", avatarPath)}${query}`;

  return url;
}

export function parsePublicStorageUrl(
  url: string
): { bucket: string; path: string } | null {
  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/public/";
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;
    const rest = parsed.pathname.slice(index + marker.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) return null;
    const bucket = decodeURIComponent(rest.slice(0, slash));
    const path = decodeURIComponent(rest.slice(slash + 1));
    if (!bucket || !path || path.includes("..")) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

export function publicStorageObjectUrl(bucket: string, objectPath: string): string[] {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base || !objectPath) return [];
  const encoded = objectPath.split("/").map(encodeURIComponent).join("/");
  return [...new Set([
    `${base}/storage/v1/object/public/${bucket}/${objectPath}`,
    `${base}/storage/v1/object/public/${bucket}/${encoded}`,
  ])];
}
