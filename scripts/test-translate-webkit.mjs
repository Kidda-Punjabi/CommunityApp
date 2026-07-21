/**
 * WebKit (Safari engine) smoke test for translate CTAs — closer than Chromium for iOS quirks.
 * Requires: dev server on :3000, logged-in session cookies optional (redirects to login if not).
 *
 *   node scripts/test-translate-webkit.mjs
 */
import { webkit, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function testLiveTranslate(page) {
  await page.goto(`${BASE}/dashboard/live-translate`, { waitUntil: "domcontentloaded", timeout: 20000 });
  if (page.url().includes("/login")) {
    console.log("live-translate: skipped (not logged in)");
    return;
  }
  const start = page.getByRole("button", { name: "Start conversation" });
  await start.waitFor({ state: "visible", timeout: 10000 });
  await start.click();
  await page.getByRole("button", { name: "End conversation" }).waitFor({ state: "visible", timeout: 5000 });
  console.log("live-translate: Start conversation → active session OK");
}

async function testPhotoTranslate(page) {
  await page.goto(`${BASE}/dashboard/photo-translate`, { waitUntil: "domcontentloaded", timeout: 20000 });
  if (page.url().includes("/login")) {
    console.log("photo-translate: skipped (not logged in)");
    return;
  }
  const takePhoto = page.getByText("Take photo", { exact: true });
  await takePhoto.waitFor({ state: "visible", timeout: 10000 });
  const tag = await takePhoto.evaluate((el) => el.tagName);
  console.log(`photo-translate: Take photo control is <${tag}> (expect LABEL)`);
}

const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();

try {
  await testLiveTranslate(page);
  await testPhotoTranslate(page);
} finally {
  await browser.close();
}
