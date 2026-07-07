/** Convert a Google Slides share URL to an embeddable iframe URL. */
export function googleSlidesEmbedUrl(presentationUrl: string): string | null {
  try {
    const parsed = new URL(presentationUrl.trim());
    if (!parsed.hostname.includes("docs.google.com")) return null;

    const match = parsed.pathname.match(/\/presentation\/d\/([^/]+)/);
    if (!match?.[1]) return null;

    return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
  } catch {
    return null;
  }
}
