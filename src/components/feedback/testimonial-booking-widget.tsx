"use client";

import Script from "next/script";
import {
  BOOKING_EMBED_SCRIPT,
  buildTestimonialCalendarIframeSrc,
  calendarWidgetId,
} from "@/lib/ghl/testimonial-calendar";

type TestimonialBookingWidgetProps = {
  calendarUrl: string;
  fullName: string;
  email: string;
  phone: string;
};

export function TestimonialBookingWidget({
  calendarUrl,
  fullName,
  email,
  phone,
}: TestimonialBookingWidgetProps) {
  const src = buildTestimonialCalendarIframeSrc(calendarUrl, { fullName, email, phone });
  const widgetId = calendarWidgetId(calendarUrl);

  return (
    <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
      <h2 className="text-lg font-semibold text-zinc-900">Book your video testimonial</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Pick a time that works. Your feedback is already saved — you can skip this if you
        prefer.
      </p>
      <iframe
        src={src}
        title="Book your Kidda video testimonial"
        allow="payment"
        style={{ width: "100%", border: "none", overflow: "hidden" }}
        scrolling="no"
        id={`${widgetId}_testimonial`}
        className="mt-4 min-h-[680px] w-full rounded-xl bg-white"
      />
      <Script src={BOOKING_EMBED_SCRIPT} strategy="afterInteractive" />
    </div>
  );
}
