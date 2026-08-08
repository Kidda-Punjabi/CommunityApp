"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PullToRefreshProps = {
  children: React.ReactNode;
  /** Threshold in pixels before refresh activates (default: 80) */
  threshold?: number;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
};

export function PullToRefresh({
  children,
  threshold = 80,
  enabled = true,
}: PullToRefreshProps) {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPulling = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start if we're at the top of the scroll
      if (container.scrollTop === 0 && !isRefreshing) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      // Only pull down, not up
      if (distance > 0) {
        // Prevent default scrolling when pulling
        if (container.scrollTop === 0) {
          e.preventDefault();
        }

        // Apply resistance as you pull further
        const resistance = 0.5;
        const adjustedDistance = distance * resistance;
        setPullDistance(adjustedDistance);

        // Lock in when threshold is reached
        if (adjustedDistance >= threshold) {
          setIsLocked(true);
        } else {
          setIsLocked(false);
        }
      }
    };

    const handleTouchEnd = () => {
      if (!isPulling.current) return;

      isPulling.current = false;

      // If locked and past threshold, trigger refresh
      if (isLocked && pullDistance >= threshold) {
        setIsRefreshing(true);
        
        // Refresh the page
        router.refresh();
        
        // Reset after a short delay to show the animation
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setIsLocked(false);
        }, 1000);
      } else {
        // Snap back if not locked
        setPullDistance(0);
        setIsLocked(false);
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, threshold, isRefreshing, pullDistance, isLocked, router]);

  const indicatorOpacity = Math.min(pullDistance / threshold, 1);
  const spinnerRotation = (pullDistance / threshold) * 360;

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Pull-to-refresh indicator */}
      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center"
        style={{
          transform: `translateY(${Math.min(pullDistance, threshold + 20)}px)`,
          transition: isPulling.current ? "none" : "transform 0.3s ease-out",
          opacity: indicatorOpacity,
        }}
      >
        <div
          className={`mt-4 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors ${
            isLocked
              ? "bg-violet-600 ring-4 ring-violet-200"
              : "bg-white ring-2 ring-zinc-200"
          }`}
        >
          {isRefreshing ? (
            // Spinning loader when refreshing
            <svg
              className="h-6 w-6 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            // Arrow that rotates as you pull
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-6 w-6 transition-colors ${
                isLocked ? "text-white" : "text-violet-600"
              }`}
              style={{
                transform: `rotate(${isLocked ? 180 : spinnerRotation}deg)`,
                transition: isPulling.current ? "none" : "transform 0.3s ease-out",
              }}
            >
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>

      {/* Status text */}
      {pullDistance > 20 && (
        <div
          className="pointer-events-none fixed left-0 right-0 top-0 z-40 flex justify-center pt-20 text-center text-sm font-semibold"
          style={{
            transform: `translateY(${Math.min(pullDistance, threshold + 20)}px)`,
            transition: isPulling.current ? "none" : "transform 0.3s ease-out",
            opacity: indicatorOpacity,
          }}
        >
          <span
            className={`rounded-full px-3 py-1 ${
              isLocked
                ? "bg-violet-100 text-violet-900"
                : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {isRefreshing
              ? "Refreshing..."
              : isLocked
                ? "Release to refresh"
                : "Pull down to refresh"}
          </span>
        </div>
      )}

      {children}
    </div>
  );
}
