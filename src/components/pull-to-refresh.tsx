"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PullToRefreshProps = {
  children: React.ReactNode;
  /** Threshold in pixels before refresh activates (default: 60) */
  threshold?: number;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
};

export function PullToRefresh({
  children,
  threshold = 60,
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
        const resistance = 0.4;
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

  return (
    <div ref={containerRef} className="relative flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Pull-to-refresh indicator - anchored to pulled space */}
      {pullDistance > 10 && (
        <div
          className="absolute left-0 right-0 flex justify-center"
          style={{
            top: `${Math.max(0, pullDistance - 40)}px`,
            transition: isPulling.current ? "none" : "top 0.3s ease-out, opacity 0.2s",
            opacity: Math.min(pullDistance / 30, 1),
          }}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
              isLocked
                ? "bg-violet-600"
                : "bg-zinc-400"
            }`}
          >
            <svg
              className={`h-5 w-5 text-white ${isRefreshing || isLocked ? "animate-spin" : ""}`}
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
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
