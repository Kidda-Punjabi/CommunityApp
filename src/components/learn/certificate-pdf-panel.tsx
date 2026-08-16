"use client";

import { pressableClass } from "@/lib/ui/pressable";
import { cn, ui } from "@/lib/ui/styles";
import { useEffect, useRef, useState } from "react";

const PDF_URL = "/api/certificates/beginner";

type CertificatePdfPanelProps = {
  fileName: string;
  shareTitle: string;
};

export function CertificatePdfPanel({ fileName, shareTitle }: CertificatePdfPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(PDF_URL, { credentials: "include" });
        if (!response.ok) {
          throw new Error("Could not load the certificate PDF.");
        }
        const pdfBlob = await response.blob();
        if (cancelled) return;
        setBlob(pdfBlob);
        blobUrlRef.current = URL.createObjectURL(pdfBlob);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load the certificate PDF.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!blob) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const pdfBlob = blob;
    const previewCanvas = canvas;
    const previewContainer = container;

    let cancelled = false;

    async function renderPreview() {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
        const data = await pdfBlob.arrayBuffer();
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;
        const page = await doc.getPage(1);
        if (cancelled) return;

        const containerWidth = previewContainer.clientWidth || 320;
        const unscaled = page.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / unscaled.width, 2);
        const viewport = page.getViewport({ scale });
        const context = previewCanvas.getContext("2d");
        if (!context) return;

        previewCanvas.width = viewport.width;
        previewCanvas.height = viewport.height;
        await page.render({ canvas: previewCanvas, canvasContext: context, viewport }).promise;
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error ? renderError.message : "Could not show the certificate PDF."
          );
        }
      }
    }

    void renderPreview();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  function viewPdf() {
    const url = blobUrlRef.current ?? `${PDF_URL}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function downloadPdf() {
    const url = blobUrlRef.current ?? `${PDF_URL}?download=1`;
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function sharePdf() {
    const title = shareTitle;
    try {
      if (blob && typeof navigator.share === "function") {
        const file = new File([blob], fileName, { type: "application/pdf" });
        const payload: ShareData = { title, text: title };
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ ...payload, files: [file] });
          return;
        }
        await navigator.share({ ...payload, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div
        ref={containerRef}
        className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-[0_4px_24px_-6px_rgba(24,24,27,0.08)]"
      >
        {loading ? (
          <div className="flex min-h-48 items-center justify-center bg-violet-50/60">
            <p className="text-sm text-zinc-500">Loading certificate…</p>
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-sm text-red-700">{error}</div>
        ) : null}
        <canvas ref={canvasRef} className={cn("block h-auto w-full", (loading || error) && "hidden")} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={viewPdf} className={ui.btnSecondary} disabled={!blob}>
          View PDF
        </button>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={!blob}
          className={cn(ui.btnPrimary, !blob && "opacity-60")}
        >
          Download PDF
        </button>
        <button
          type="button"
          onClick={() => void sharePdf()}
          className={cn(pressableClass, ui.btnSecondary)}
        >
          {copied ? "Link copied" : "Share"}
        </button>
      </div>
    </div>
  );
}
