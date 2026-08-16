"use client";

import { pressableClass } from "@/lib/ui/pressable";
import { cn, ui } from "@/lib/ui/styles";
import { useState } from "react";

export function CertificateShareButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    const title = "Kidda Beginner Certificate";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={() => void share()} className={ui.btnSecondary}>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

export function CertificateDownloadStub() {
  return (
    <button
      type="button"
      disabled
      title="PDF download coming soon"
      className={cn(
        pressableClass,
        "inline-flex items-center justify-center rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white opacity-60"
      )}
    >
      Download PDF
    </button>
  );
}
