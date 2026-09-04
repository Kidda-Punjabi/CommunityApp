const BOOKING_EMBED_SCRIPT = "https://link.msgsndr.com/js/form_embed.js";

export function getTestimonialCalendarUrl(): string | null {
  const raw = process.env.GHL_TESTIMONIAL_CALENDAR_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return null;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(" ");
  if (space === -1) {
    return { firstName: trimmed, lastName: "" };
  }
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1),
  };
}

export function calendarWidgetId(calendarUrl: string): string {
  try {
    const id = new URL(calendarUrl).pathname.split("/").filter(Boolean).pop();
    return id || "ghl-testimonial-calendar";
  } catch {
    return "ghl-testimonial-calendar";
  }
}

export function buildTestimonialCalendarIframeSrc(
  calendarUrl: string,
  contact: { fullName: string; email: string; phone: string }
): string {
  const url = new URL(calendarUrl);
  const { firstName, lastName } = splitFullName(contact.fullName);
  const query = [
    `first_name=${encodeURIComponent(firstName)}`,
    `last_name=${encodeURIComponent(lastName)}`,
    `email=${encodeURIComponent(contact.email.trim())}`,
    `phone=${encodeURIComponent(contact.phone.trim())}`,
  ].join("&");
  const base = `${url.origin}${url.pathname}`.replace(/\/$/, "");
  return `${base}?${query}`;
}

export { BOOKING_EMBED_SCRIPT };
