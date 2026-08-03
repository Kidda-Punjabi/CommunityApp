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
  destroyActiveTour,
  runAppTour,
  runCourseResourceTourQueue,
} from "@/lib/tours/driver-tours";
import {
  learnTileTourSelector,
  type CourseTourTarget,
} from "@/lib/tours/course-tile";

export const ONBOARDING_COMPLETE_EVENT = "kidda:onboarding-complete";

const APP_TOUR_SESSION_KEY = "kidda:app-tour-completed";
const COURSE_QUEUE_KEY = "kidda:course-tour-queue";

type StoredCourseQueue = {
  targets: CourseTourTarget[];
  persist: boolean;
};

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

function sessionAppTourDone(): boolean {
  try {
    return sessionStorage.getItem(APP_TOUR_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function setSessionAppTourDone() {
  try {
    sessionStorage.setItem(APP_TOUR_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearSessionAppTourDone() {
  try {
    sessionStorage.removeItem(APP_TOUR_SESSION_KEY);
  } catch {
    // ignore
  }
}

function readStoredCourseQueue(): StoredCourseQueue | null {
  try {
    const raw = sessionStorage.getItem(COURSE_QUEUE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCourseQueue;
  } catch {
    return null;
  }
}

function writeStoredCourseQueue(queue: StoredCourseQueue | null) {
  try {
    if (!queue || queue.targets.length === 0) {
      sessionStorage.removeItem(COURSE_QUEUE_KEY);
      return;
    }
    sessionStorage.setItem(COURSE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
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
  const pendingCoursesRef = useRef(pendingCourseTours);
  pendingCoursesRef.current = pendingCourseTours;
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);

  const ensureLearnHub = useCallback(async (): Promise<boolean> => {
    if (window.location.pathname === "/dashboard/learn") {
      const ready = await waitForSelector(
        '[data-tour="learn-tile-foundational"], [data-tour="learn-tile-beginners"], [data-tour="learn-tile-community"]',
        5000
      );
      return Boolean(ready);
    }

    // Soft navigate first.
    router.push("/dashboard/learn");
    const start = Date.now();
    while (Date.now() - start < 2500) {
      if (window.location.pathname === "/dashboard/learn") {
        const ready = await waitForSelector(
          '[data-tour="learn-tile-foundational"], [data-tour="learn-tile-beginners"], [data-tour="learn-tile-community"]',
          5000
        );
        return Boolean(ready);
      }
      await wait(100);
    }
    return false;
  }, [router]);

  const runCourseQueue = useCallback(
    async (targets: CourseTourTarget[], persist: boolean) => {
      if (targets.length === 0) return;

      const onLearn = await ensureLearnHub();
      if (!onLearn) {
        writeStoredCourseQueue({ targets, persist });
        window.location.assign("/dashboard/learn");
        return;
      }

      const steps: Array<{
        selector: string;
        courseName: string;
        courseId: string;
      }> = [];
      for (const target of targets) {
        const selector = learnTileTourSelector(target.tileId);
        const el = await waitForSelector(selector, 8000);
        if (!el) {
          if (persist) {
            await markCourseResourceTourSeen(target.courseId);
          }
          continue;
        }
        steps.push({
          selector,
          courseName: target.courseName,
          courseId: target.courseId,
        });
      }

      if (steps.length === 0) {
        writeStoredCourseQueue(null);
        return;
      }

      await new Promise<void>((resolve) => {
        runCourseResourceTourQueue({
          steps,
          onStepShown: async (stepIndex) => {
            if (!persist) return;
            const step = steps[stepIndex];
            if (!step) return;
            const result = await markCourseResourceTourSeen(step.courseId);
            if (result.error) {
              console.error("markCourseResourceTourSeen", result.error);
            }
          },
          onComplete: async () => {
            if (persist) {
              for (const step of steps) {
                const result = await markCourseResourceTourSeen(step.courseId);
                if (result.error) {
                  console.error("markCourseResourceTourSeen", result.error);
                }
              }
            }
            resolve();
          },
        });
      });

      destroyActiveTour();
      writeStoredCourseQueue(null);
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
      if (
        pathname.startsWith("/dashboard/tutor") ||
        pathname.startsWith("/dashboard/kids") ||
        pathname.startsWith("/dashboard/placement")
      ) {
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
                onComplete: async () => {
                  if (options.persistAppTour) {
                    setSessionAppTourDone();
                    const result = await markAppTourSeen();
                    if (result.error) {
                      console.error("markAppTourSeen", result.error);
                    }
                  }
                  resolve();
                },
              });
            });
            await wait(300);
          } else if (options.persistAppTour) {
            setSessionAppTourDone();
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

  // Resume hard-nav course queue on Learn.
  useEffect(() => {
    if (kidsShellActive) return;
    if (pathname !== "/dashboard/learn") return;
    const stored = readStoredCourseQueue();
    if (!stored?.targets.length) return;
    if (runningRef.current) return;

    bootstrappedRef.current = true;
    const timer = window.setTimeout(() => {
      // Clear only when we actually start — avoids Strict Mode wiping the queue.
      writeStoredCourseQueue(null);
      void runSequencedTours({
        appTour: false,
        persistAppTour: false,
        courseTargets: stored.targets,
        persistCourseTours: stored.persist,
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [kidsShellActive, pathname, runSequencedTours]);

  // Real triggers on load: Part 1 (if due) then Part 2.
  useEffect(() => {
    if (bootstrappedRef.current || kidsShellActive) return;
    if (!hasSeenOnboarding) return;
    if (pathname.startsWith("/dashboard/placement")) return;
    // Let the resume effect own Learn when a stored queue exists.
    if (pathname === "/dashboard/learn" && readStoredCourseQueue()) return;

    // Server is source of truth after Reset — drop a stale session guard.
    if (!hasSeenAppTour) clearSessionAppTourDone();

    const appAlreadyDone = hasSeenAppTour || sessionAppTourDone();
    const appDue = !appAlreadyDone;
    const coursesDue = pendingCoursesRef.current;
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
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    hasSeenOnboarding,
    hasSeenAppTour,
    kidsShellActive,
    pathname,
    runSequencedTours,
  ]);

  useEffect(() => {
    function onOnboardingComplete() {
      bootstrappedRef.current = true;
      const appAlreadyDone = hasSeenAppTour || sessionAppTourDone();
      void runSequencedTours({
        appTour: !appAlreadyDone,
        persistAppTour: true,
        courseTargets: pendingCoursesRef.current,
        persistCourseTours: true,
      });
    }

    window.addEventListener(ONBOARDING_COMPLETE_EVENT, onOnboardingComplete);
    return () =>
      window.removeEventListener(ONBOARDING_COMPLETE_EVENT, onOnboardingComplete);
  }, [hasSeenAppTour, runSequencedTours]);

  useEffect(() => {
    if (hasSeenAppTour) setSessionAppTourDone();
    else clearSessionAppTourDone();
  }, [hasSeenAppTour]);

  const previewAppTour = useCallback(() => {
    setPreviewNotice(null);
    destroyActiveTour();
    runningRef.current = false;
    void runSequencedTours({
      appTour: true,
      persistAppTour: false,
      courseTargets: [],
      persistCourseTours: false,
    });
  }, [runSequencedTours]);

  const previewCourseResourceTour = useCallback(async () => {
    destroyActiveTour();
    runningRef.current = false;
    const result = await loadPreviewCourseResourceTours();
    if (result.targets.length === 0) {
      const message = result.emptyReason ?? "No courses to preview.";
      setPreviewNotice(message);
      return message;
    }
    setPreviewNotice(null);

    // Soft-nav first (same path as real Part 2). Fall back to hard nav + resume.
    const onLearn =
      window.location.pathname === "/dashboard/learn" ||
      (await (async () => {
        router.push("/dashboard/learn");
        const start = Date.now();
        while (Date.now() - start < 3000) {
          if (window.location.pathname === "/dashboard/learn") return true;
          await wait(100);
        }
        return false;
      })());

    if (!onLearn) {
      writeStoredCourseQueue({ targets: result.targets, persist: false });
      window.location.assign("/dashboard/learn");
      return null;
    }

    await runSequencedTours({
      appTour: false,
      persistAppTour: false,
      courseTargets: result.targets,
      persistCourseTours: false,
    });
    return null;
  }, [router, runSequencedTours]);

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
