import { defineConfig } from "@playwright/test";

const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 KiddaApp/1.0";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    reducedMotion: "reduce",
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    userAgent: iphone,
    isMobile: true,
    hasTouch: true,
  },
  webServer: {
    command: "npm run dev -- --port 3000",
    url: "http://localhost:3000/onboarding-frame-preview",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
