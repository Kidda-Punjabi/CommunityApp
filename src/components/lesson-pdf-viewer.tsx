"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveLessonPdfProgress } from "@/lib/progress/lesson-progress";
import { notifyPointsEarned } from "@/lib/points/notify-points-earned";
import { recordStreakActivity } from "@/lib/progress/streak";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

type LessonPdfViewerProps = {
  lessonId: string;
  pdfUrl: string;
  initialLastPage?: number;
  initialPdfCompleted?: boolean;
};

export function LessonPdfViewer({
  lessonId,
  pdfUrl,
  initialLastPage = 0,
  initialPdfCompleted = false,
}: LessonPdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef<string | null>(null);
  const pdfDocRef = useRef<
    import("pdfjs-dist/legacy/build/pdf.mjs").PDFDocumentProxy | null
  >(null);
  const pdfCompletedRef = useRef(initialPdfCompleted);
  const [pdfCompleted, setPdfCompleted] = useState(initialPdfCompleted);
  const touchStartXRef = useRef(0);
  const renderTaskRef = useRef<
    import("pdfjs-dist/legacy/build/pdf.mjs").RenderTask | null
  >(null);

  const [page, setPage] = useState(() => Math.max(initialLastPage, 1));
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  const persistPage = useCallback(
    async (pageNumber: number, pagesTotal: number, forceComplete = false) => {
      const userId = userIdRef.current;
      if (!userId || pagesTotal <= 0) return;

      const reachedEnd = pageNumber >= pagesTotal;
      const shouldComplete = pdfCompletedRef.current || reachedEnd || forceComplete;
      const wasCompleted = pdfCompletedRef.current;

      const supabase = createClient();
      const lessonBonus = await saveLessonPdfProgress(supabase, userId, {
        lessonId,
        lastPageViewed: pageNumber,
        totalPages: pagesTotal,
        pdfCompleted: shouldComplete,
      });

      if (lessonBonus > 0) {
        notifyPointsEarned(lessonBonus);
      }

      if (shouldComplete && !wasCompleted) {
        pdfCompletedRef.current = true;
        setPdfCompleted(true);
        await recordStreakActivity(supabase, userId);
      }
    },
    [lessonId]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);

      try {
        const pdfjs: PdfJsModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

        const doc = await pdfjs.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;

        pdfDocRef.current = doc;
        const count = doc.numPages;
        setTotalPages(count);

        const resumePage =
          initialLastPage > 0 && initialLastPage <= count
            ? initialLastPage
            : 1;
        setPage(resumePage);

        if (initialPdfCompleted) {
          pdfCompletedRef.current = true;
          setPdfCompleted(true);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load PDF."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      pdfDocRef.current = null;
    };
  }, [pdfUrl, initialLastPage, initialPdfCompleted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || totalPages <= 0) return;

    let cancelled = false;

    async function renderPage() {
      const activeDoc = pdfDocRef.current;
      const activeCanvas = canvasRef.current;
      if (!activeDoc || !activeCanvas) return;

      setRendering(true);

      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const pdfPage = await activeDoc.getPage(page);
        if (cancelled) return;

        const containerWidth = containerRef.current?.clientWidth ?? 320;
        const unscaled = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / unscaled.width, 2);
        const viewport = pdfPage.getViewport({ scale });

        const context = activeCanvas.getContext("2d");
        if (!context) return;

        activeCanvas.width = viewport.width;
        activeCanvas.height = viewport.height;

        const task = pdfPage.render({ canvas: activeCanvas, canvasContext: context, viewport });
        renderTaskRef.current = task;
        await task.promise;

        if (!cancelled) {
          await persistPage(page, totalPages);
        }
      } catch (renderError) {
        if (
          !cancelled &&
          !(renderError instanceof Error && renderError.message.includes("cancelled"))
        ) {
          setError(
            renderError instanceof Error ? renderError.message : "Failed to render page."
          );
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [page, totalPages, persistPage]);

  function goToPage(next: number) {
    if (totalPages <= 0) return;
    setPage(Math.min(Math.max(next, 1), totalPages));
  }

  function handleTouchStart(event: React.TouchEvent) {
    touchStartXRef.current = event.touches[0]?.clientX ?? 0;
  }

  function handleTouchEnd(event: React.TouchEvent) {
    const touchEndX = event.changedTouches[0]?.clientX ?? 0;
    const delta = touchEndX - touchStartXRef.current;
    if (Math.abs(delta) < 50) return;

    if (delta > 0) goToPage(page - 1);
    else goToPage(page + 1);
  }

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
        <p className="text-sm text-zinc-500">Loading PDF…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-violet-700">
          Page {page} of {totalPages}
        </p>
        {pdfCompleted && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-[10px] leading-none">
              ✓
            </span>
            Completed
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1 || rendering}
          aria-label="Previous page"
          className="absolute left-2 top-2 z-10 rounded-full bg-white/90 p-2 text-lg leading-none text-zinc-600 shadow-sm transition-colors hover:bg-white hover:text-violet-600 disabled:pointer-events-none disabled:opacity-30"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages || rendering}
          aria-label="Next page"
          className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-2 text-lg leading-none text-zinc-600 shadow-sm transition-colors hover:bg-white hover:text-violet-600 disabled:pointer-events-none disabled:opacity-30"
        >
          →
        </button>

        <div className="flex justify-center bg-zinc-50 p-3">
          <canvas ref={canvasRef} className="max-w-full" />
        </div>
      </div>

      <p className="text-center text-xs text-zinc-500">
        Swipe left or right to change pages
      </p>
    </div>
  );
}
