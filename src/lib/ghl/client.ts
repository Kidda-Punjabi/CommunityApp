import "server-only";

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";
const GHL_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const GHL_LOCATION_ID =
  process.env.GHL_LOCATION_ID?.trim() || "HCTgQkfPpkO6GkhxWGj6";

export class GhlApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`GHL API error (${status}): ${body.slice(0, 500)}`);
    this.name = "GhlApiError";
  }
}

export function getGhlApiKey(): string {
  const key = process.env.GHL_API_KEY?.trim();
  if (!key) {
    throw new Error("GoHighLevel is not configured (GHL_API_KEY).");
  }
  return key;
}

export async function ghlJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = path.startsWith("http") ? path : `${GHL_API_BASE}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${getGhlApiKey()}`,
        Version: GHL_API_VERSION,
        Accept: "application/json",
        "User-Agent": GHL_USER_AGENT,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new GhlApiError(408, "GHL request timed out");
    }
    throw error;
  }
  const body = await response.text();
  if (!response.ok) {
    throw new GhlApiError(response.status, body);
  }
  return JSON.parse(body) as T;
}
