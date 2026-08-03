import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const POPOVER_CLASS = "kidda-tour-popover";

const baseConfig = {
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
  showButtons: ["next", "close"] as Array<"next" | "previous" | "close">,
  onPopoverRender: (popover: { closeButton: HTMLButtonElement }) => {
    // Treat the default close control as Skip (preview + real tours).
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

export function runAppTour(options: {
  persist: boolean;
  onComplete: () => void | Promise<void>;
}): void {
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    void Promise.resolve(options.onComplete());
  };

  const d = driver({
    ...baseConfig,
    steps: APP_TOUR_STEPS,
    onDestroyed: () => {
      finish();
    },
    onCloseClick: (_el, _step, { driver: drv }) => {
      drv.destroy();
    },
  });

  // persist flag reserved for callers — they decide whether to write onComplete
  void options.persist;
  d.drive();
}

export function runCourseResourceTour(options: {
  selector: string;
  courseName: string;
  onComplete: () => void | Promise<void>;
}): void {
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    void Promise.resolve(options.onComplete());
  };

  const d = driver({
    ...baseConfig,
    showProgress: false,
    steps: [
      {
        element: options.selector,
        popover: {
          title: "Your course resources",
          description: `We can see you've got ${options.courseName} — here's where your resources will be.`,
          side: "bottom",
          align: "start",
          doneBtnText: "Got it",
        },
      },
    ],
    waitForElement: 8000,
    skipMissingElement: false,
    onDestroyed: () => {
      finish();
    },
    onCloseClick: (_el, _step, { driver: drv }) => {
      drv.destroy();
    },
  });

  d.drive();
}

export function courseResourceTourDescription(courseName: string): string {
  return `We can see you've got ${courseName} — here's where your resources will be.`;
}
