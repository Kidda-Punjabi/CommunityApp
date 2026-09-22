import { createBrowserClient } from "@supabase/ssr";
import { HOMEWORK_RECORDINGS_BUCKET } from "@/lib/tutoring/homework-submissions";

/**
 * Browser fetch that reports upload progress for the storage PUT.
 * Signed-upload calls send FormData; other requests (session refresh) use fetch.
 */
function fetchWithUploadProgress(onProgress: (percent: number) => void): typeof fetch {
  return async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url =
      request?.url ?? (input instanceof URL ? input.href : String(input));
    const method = init?.method ?? request?.method ?? "GET";
    const headers = new Headers(request?.headers);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    const body = init?.body ?? null;
    const trackable = body instanceof FormData || body instanceof Blob;
    if (typeof XMLHttpRequest === "undefined" || !trackable) {
      return fetch(input, init);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.responseType = "text";
      headers.forEach((value, key) => {
        if (body instanceof FormData && key.toLowerCase() === "content-type") return;
        xhr.setRequestHeader(key, value);
      });
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) return;
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      };
      xhr.onload = () => {
        const responseHeaders = new Headers();
        const raw = xhr.getAllResponseHeaders().trim();
        if (raw) {
          for (const line of raw.split(/[\r\n]+/)) {
            const index = line.indexOf(":");
            if (index > 0) {
              responseHeaders.append(line.slice(0, index).trim(), line.slice(index + 1).trim());
            }
          }
        }
        resolve(
          new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: responseHeaders,
          })
        );
      };
      xhr.onerror = () => reject(new TypeError("Network request failed"));
      xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
      xhr.send(body);
    });
  };
}

export async function uploadHomeworkRecordingToSignedUrl(input: {
  path: string;
  token: string;
  file: File;
  onProgress: (percent: number) => void;
}): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: fetchWithUploadProgress(input.onProgress),
      },
    }
  );

  const { error } = await supabase.storage
    .from(HOMEWORK_RECORDINGS_BUCKET)
    .uploadToSignedUrl(input.path, input.token, input.file, {
      contentType: input.file.type || "audio/webm",
      upsert: false,
    });

  return error ? error.message : null;
}
