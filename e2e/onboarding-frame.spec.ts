import { expect, test } from "@playwright/test";

const STEPS = ["welcome", "session", "why", "levels", "placement", "done"] as const;

async function layout(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const offenders: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 && rect.height < 1) continue;
      if (rect.left < -1 || rect.right > width + 1) {
        const name = el.getAttribute("data-testid") || el.tagName.toLowerCase();
        offenders.push(`${name} ${Math.round(rect.left)}..${Math.round(rect.right)}`);
      }
    }
    const frame = document.querySelector("[data-testid='onboarding-frame']");
    const frameStyle = frame ? getComputedStyle(frame) : null;
    const nav = document.querySelector("nav");
    const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
    let aboveNav = "";
    let node = document.elementFromPoint(width / 2, Math.max(0, navTop - 4));
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        aboveNav = bg;
        break;
      }
      node = node.parentElement;
    }
    const action = frame?.querySelector("[data-testid='onboarding-action']");
    const actionBox = action?.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: width,
      offenders: offenders.slice(0, 6),
      padLeft: frameStyle ? parseFloat(frameStyle.paddingLeft) : -1,
      padRight: frameStyle ? parseFloat(frameStyle.paddingRight) : -1,
      aboveNav,
      actionBottom: actionBox ? actionBox.bottom : -1,
      navTop,
      actionRight: actionBox ? actionBox.right : -1,
      actionLeft: actionBox ? actionBox.left : -1,
    };
  });
}

for (const step of STEPS) {
  test(`${step} stays inside the phone`, async ({ page }) => {
    await page.goto(`/onboarding-frame-preview?step=${step}`);
    await expect(page.getByTestId("onboarding-frame")).toBeVisible();
    const box = await layout(page);
    expect(box.scrollWidth, JSON.stringify(box)).toBe(box.innerWidth);
    expect(box.offenders, JSON.stringify(box)).toEqual([]);
    expect(box.padLeft).toBe(20);
    expect(box.padRight).toBe(20);
    expect(box.aboveNav).toBe("rgb(247, 245, 252)");
    expect(box.actionBottom).toBeLessThan(box.navTop);
    expect(box.actionBottom).toBeGreaterThan(box.navTop - 40);
    expect(box.actionLeft).toBeGreaterThanOrEqual(19);
    expect(box.actionRight).toBeLessThanOrEqual(box.innerWidth - 19);
  });
}
