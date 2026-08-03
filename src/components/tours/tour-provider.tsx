"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  markAppTourSeen,
  markCourseResourceTourSeen,
  loadPreviewCourseResourceTours,
} from "@/app/dashboard/tours/actions";
import {
  runAppTour,
  runCourseResourceTour,
} from "@/lib/tours/driver-tours";
import {
  learnTileTourSelector,
  type CourseTourTarget,
} from "@/lib/tours/course-tile";

export const ONBOARDING_COMPLETE_EVENT = "kidda:onboarding-complete";

type TourContextValue = {
  previewAppTour: () => void;
  previewCourseResourceTour: () => Promise<string | null>;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useAppTours() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useAppTours must be used within TourProvider");
  return ctx;
}

type TourProviderProps = {
  hasSeenOnboarding: boolean;
  hasSeenAppTour: boolean;
  pendingCourseTours: CourseTourTarget[];
  kidsShellActive: boolean;
  children: React.ReactNode;
};

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForSelector(
  selector: string,
  timeoutMs = 8000
): Promise<Element | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(selector);
    if (el) return el;
    await wait(100);
  }
  return null;
}

export function TourProvider({
  hasSeenOnboarding,
  hasSeenAppTour,
  pendingCourseTours,
  kidsShellActive,
  children,
}: TourProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const runningRef = useRef(false);
  const bootstrappedRef = useRef(false);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);

  const ensureLearnHub = useCallback(async () => {
    if (pathname === "/dashboard/learn") {
      await wait(50);
      return;
    }
    router.push("/dashboard/learn");
    await waitForSelector('[data-tour="learn-tile-foundational"], [data-tour="learn-tile-beginners"]');
    await wait(150);
  }, [pathname, router]);

  const runCourseQueue = useCallback(
    async (targets: CourseTourTarget[], persist: boolean) => {
      for (const target of targets) {
        await ensureLearnHub();
        const selector = learnTileTourSelector(target.tileId);
        const el = await waitForSelector(selector, 8000);
        if (!el) {
          if (persist) {
            await markCourseResourceTourSeen(target.courseId);
          }
          continue;
        }

        await new Promise<void>((resolve) => {
          runCourseResourceTour({
            selector,
            courseName: target.courseName,
            onComplete: async () => {
              if (persist) {
                await markCourseResourceTourSeen(target.courseId);
              }
              resolve();
            },
          });
        });
        await wait(200);
      }
    },
    [ensureLearnHub]
  );

  const runSequencedTours = useCallback(
    async (options: {
      appTour: boolean;
      persistAppTour: boolean;
      courseTargets: CourseTourTarget[];
      persistCourseTours: boolean;
    }) => {
      if (runningRef.current || kidsShellActive) return;
      if (pathname.startsWith("/dashboard/tutor") || pathname.startsWith("/dashboard/kids")) {
        return;
      }
      if (!options.appTour && options.courseTargets.length === 0) return;

      runningRef.current = true;
      try {
        if (options.appTour) {
          const homeNav = await waitForSelector('[data-tour="nav-home"]', 5000);
          if (homeNav) {
            await new Promise<void>((resolve) => {
              runAppTour({
                persist: options.persistAppTour,
                onComplete: async () => {
                  if (options.persistAppTour) {
                    await markAppTourSeen();
                  }
                  resolve();
                },
              });
            });
            await wait(250);
          } else if (options.persistAppTour) {
            await markAppTourSeen();
          }
        }

        if (options.courseTargets.length > 0) {
          await runCourseQueue(options.courseTargets, options.persistCourseTours);
        }
      } finally {
        runningRef.current = false;
      }
    },
    [kidsShellActive, pathname, runCourseQueue]
  );

  // Real triggers on load: Part 1 (if due) then Part 2.
  // Skip while learner-info onboarding is still open, or during placement (right after onboarding).
  useEffect(() => {
    if (bootstrappedRef.current || kidsShellActive) return;
    if (!hasSeenOnboarding) return;
    if (pathname.startsWith("/dashboard/placement")) return;

    const appDue = !hasSeenAppTour;
    const coursesDue = pendingCourseTours;
    if (!appDue && coursesDue.length === 0) {
      bootstrappedRef.current = true;
      return;
    }

    bootstrappedRef.current = true;
    const timer = window.setTimeout(() => {
      void runSequencedTours({
        appTour: appDue,
        persistAppTour: true,
        courseTargets: coursesDue,
        persistCourseTours: true,
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    hasSeenOnboarding,
    hasSeenAppTour,
    pendingCourseTours,
    kidsShellActive,
    pathname,
    runSequencedTours,
  ]);

  // After learner-info onboarding completes (non-test), kick off Part 1 then Part 2.
  useEffect(() => {
    function onOnboardingComplete() {
      bootstrappedRef.current = true;
      if (kidsShellActive || hasSeenAppTour) {
        // App tour already done — still may need course tours.
        if (pendingCourseTours.length > 0) {
          void runSequencedTours({
            appTour: false,
            persistAppTour: false,
            courseTargets: pendingCourseTours,
            persistCourseTours: true,
          });
        }
        return;
      }
      void runSequencedTours({
        appTour: true,
        persistAppTour: true,
        courseTargets: pendingCourseTours,
        persistCourseTours: true,
      });
    }

    window.addEventListener(ONBOARDING_COMPLETE_EVENT, onOnboardingComplete);
    return () =>
      window.removeEventListener(ONBOARDING_COMPLETE_EVENT, onOnboardingComplete);
  }, [
    kidsShellActive,
    hasSeenAppTour,
    pendingCourseTours,
    runSequencedTours,
  ]);

  const previewAppTour = useCallback(() => {
    setPreviewNotice(null);
    void runSequencedTours({
      appTour: true,
      persistAppTour: false,
      courseTargets: [],
      persistCourseTours: false,
    });
  }, [runSequencedTours]);

  const previewCourseResourceTour = useCallback(async () => {
    const result = await loadPreviewCourseResourceTours();
    if (result.targets.length === 0) {
      const message = result.emptyReason ?? "No courses to preview.";
      setPreviewNotice(message);
      return message;
    }
    setPreviewNotice(null);
    await runSequencedTours({
      appTour: false,
      persistAppTour: false,
      courseTargets: result.targets,
      persistCourseTours: false,
    });
    return null;
  }, [runSequencedTours]);

  const value = useMemo(
    () => ({ previewAppTour, previewCourseResourceTour }),
    [previewAppTour, previewCourseResourceTour]
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {previewNotice ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[10000] max-w-sm -translate-x-1/2 rounded-xl border border-violet-200 bg-white px-4 py-3 text-center text-sm font-medium text-violet-800 shadow-lg"
        >
          {previewNotice}
          <button
            type="button"
            className="mt-2 block w-full text-xs font-semibold text-violet-600"
            onClick={() => setPreviewNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </TourContext.Provider>
  );
}
