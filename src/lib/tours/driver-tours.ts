import { driver, type Config, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const POPOVER_CLASS = "kidda-tour-popover";

let activeDriver: Driver | null = null;

export function destroyActiveTour(): void {
  if (!activeDriver) return;
  const current = activeDriver;
  activeDriver = null;
  try {
    current.destroy();
  } catch {
    // already torn down
  }
  document.body.classList.remove("driver-active", "driver-fade");
  document
    .querySelectorAll(".driver-active-element, .driver-active-element-parent")
    .forEach((el) => {
      el.classList.remove("driver-active-element", "driver-active-element-parent");
    });
  document.querySelectorAll(".driver-overlay, .driver-popover").forEach((el) => el.remove());
}

const baseConfig: Config = {
  animate: true,
  allowClose: true,
  overlayColor: "#18181b",
  overlayOpacity: 0.55,
  stagePadding: 8,
  stageRadius: 12,
  popoverClass: POPOVER_CLASS,
  showProgress: true,
  progressText: "{{current}} of {{total}}",
  nextBtnText: "Next",
  doneBtnText: "Done",
  prevBtnText: "Back",
  showButtons: ["next", "close"],
  onPopoverRender: (popover) => {
    if (popover.closeButton) {
      popover.closeButton.setAttribute("aria-label", "Skip");
      popover.closeButton.title = "Skip";
    }
  },
};

export const APP_TOUR_STEPS: DriveStep[] = [
  {
    element: '[data-tour="nav-home"]',
    popover: {
      title: "Home",
      description:
        "Your streak and today’s focus live here — a quick check-in for what to do next.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-learn"]',
    popover: {
      title: "Learn",
      description:
        "Courses and weekly lessons. Open a track to work through your resources.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-games"]',
    popover: {
      title: "Games",
      description:
        "Practice with games here. The Dictionary also lives under Games.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-community"]',
    popover: {
      title: "Community",
      description: "People, events, and the forum — connect with other learners.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-profile"]',
    popover: {
      title: "Profile",
      description: "Progress, level, and settings — all in one place.",
      side: "top",
      align: "center",
    },
  },
];

function runTour(config: Config, onComplete: () => void | Promise<void>): void {
  destroyActiveTour();

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    activeDriver = null;
    void Promise.resolve(onComplete()).catch(() => {
      // Persist errors should not block the queue.
    });
  };

  const d = driver({
    ...baseConfig,
    ...config,
    onDestroyed: () => {
      finish();
    },
  });

  activeDriver = d;
  d.drive();
}

export function runAppTour(options: {
  onComplete: () => void | Promise<void>;
}): void {
  runTour({ steps: APP_TOUR_STEPS }, options.onComplete);
}

export function runCourseResourceTourQueue(options: {
  steps: Array<{ selector: string; courseName: string; courseId?: string }>;
  onStepShown?: (stepIndex: number) => void | Promise<void>;
  onComplete: () => void | Promise<void>;
}): void {
  if (options.steps.length === 0) {
    void Promise.resolve(options.onComplete());
    return;
  }

  runTour(
    {
      showProgress: options.steps.length > 1,
      progressText: "{{current}} of {{total}}",
      waitForElement: 8000,
      steps: options.steps.map((step, index) => ({
        element: step.selector,
        popover: {
          title: "Your course resources",
          description: `We can see you've got ${step.courseName} — here's where your resources will be.`,
          side: "bottom" as const,
          align: "start" as const,
          doneBtnText: "Got it",
          nextBtnText: "Next",
        },
        onHighlighted: () => {
          void Promise.resolve(options.onStepShown?.(index));
        },
      })),
    },
    options.onComplete
  );
}

export function runCourseResourceTour(options: {
  selector: string;
  courseName: string;
  onComplete: () => void | Promise<void>;
}): void {
  runCourseResourceTourQueue({
    steps: [{ selector: options.selector, courseName: options.courseName }],
    onComplete: options.onComplete,
  });
}
