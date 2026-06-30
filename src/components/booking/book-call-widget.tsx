"use client";

import { BOOKING_WIDGET } from "@/lib/booking/constants";
import Script from "next/script";

type BookCallWidgetProps = {
  className?: string;
};

export function BookCallWidget({ className }: BookCallWidgetProps) {
  return (
    <div className={className}>
      <iframe
        src={BOOKING_WIDGET.iframeSrc}
        style={{ width: "100%", border: "none", overflow: "hidden" }}
        scrolling="no"
        id={BOOKING_WIDGET.iframeId}
        title="Book a call with the Kidda team"
        className="min-h-[680px]"
      />
      <Script src={BOOKING_WIDGET.embedScriptSrc} strategy="afterInteractive" />
    </div>
  );
}
