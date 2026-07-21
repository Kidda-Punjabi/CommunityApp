/**
 * Smoke test Lane Runner after phaseRef fix.
 * Usage: node --env-file=.env.local scripts/smoke-lane-runner.mjs
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const TEST_EMAIL = process.env.SMOKE_TEST_EMAIL ?? "hello@kidda.app";

async function playwrightCookiesForTestUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const admin = createClient(url, service);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_EMAIL,
  });
  if (linkError) throw new Error(`generateLink: ${linkError.message}`);
  const otp = link.properties?.email_otp;
  if (!otp) throw new Error("No email_otp on generateLink response");

  const jar = [];
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => jar,
      setAll: (toSet) => {
        for (const cookie of toSet) {
          const index = jar.findIndex((c) => c.name === cookie.name);
          if (index >= 0) jar[index] = cookie;
          else jar.push(cookie);
        }
      },
    },
  });

  const { error: otpError } = await supabase.auth.verifyOtp({
    email: TEST_EMAIL,
    token: otp,
    type: "email",
  });
  if (otpError) throw new Error(`verifyOtp: ${otpError.message}`);

  const host = new URL(BASE_URL).hostname;
  return jar.map((c) => ({
    name: c.name,
    value: c.value,
    domain: host,
    path: c.path ?? "/",
    httpOnly: c.httpOnly ?? false,
    secure: c.secure ?? false,
    sameSite: c.sameSite ?? "Lax",
  }));
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const before = await supabase
    .from("game_scores")
    .select("id, score, achieved_at")
    .eq("game_type", "lane_runner")
    .order("achieved_at", { ascending: false })
    .limit(3);

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
  });
  const context = await browser.newContext();
  await context.addCookies(await playwrightCookiesForTestUser());
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/dashboard/games/lane-runner`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });

    const startBtn = page.getByRole("button", { name: /start run/i });
    const needFlashcards = await page.getByText(/need at least 3 flashcards/i).isVisible().catch(() => false);
    if (needFlashcards) {
      throw new Error("Cannot start — fewer than 3 flashcards loaded.");
    }

    await startBtn.click();

    await page.getByText("Collect the coins!").waitFor({ timeout: 10_000 });

    const coinLocator = page.locator(".lane-runner-coin-body").first();
    await coinLocator.waitFor({ state: "visible", timeout: 10_000 });

    const box1 = await coinLocator.boundingBox();
    await page.waitForTimeout(800);
    const box2 = await coinLocator.boundingBox();
    const coinMoved =
      box1 &&
      box2 &&
      (Math.abs(box1.y - box2.y) > 2 || Math.abs(box1.x - box2.x) > 2);

    if (!coinMoved) {
      throw new Error("Coins visible but did not move — collectible beat may still be stuck.");
    }

    await page.waitForFunction(
      () => {
        const tiles = document.querySelectorAll(
          ".flex.min-h-\\[5rem\\].flex-col.items-center.justify-center.rounded-xl"
        );
        return tiles.length >= 3;
      },
      { timeout: 35_000 }
    );

    const gateText = await page
      .locator(".flex.min-h-\\[5rem\\].flex-col.items-center.justify-center.rounded-xl p")
      .first()
      .textContent();
    if (!gateText?.trim()) {
      throw new Error("Gate phase reached but no flashcard text on lane tiles.");
    }

    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: /right/i }).click().catch(() => {});
      await page.waitForTimeout(5500);
    }

    await page.getByText(/run over|game over|play again/i).waitFor({ timeout: 90_000 }).catch(async () => {
      const livesZero = await page.getByLabel(/0 lives/i).isVisible().catch(() => false);
      if (!livesZero) throw new Error("Game over UI did not appear within timeout.");
    });

    await page.waitForTimeout(1500);

    const { data: userData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = userData?.users?.find(
      (u) => u.email?.toLowerCase() === TEST_EMAIL.toLowerCase()
    );
    if (!user) throw new Error(`Test user ${TEST_EMAIL} not found`);

    const { data: scores, error: scoreErr } = await supabase
      .from("game_scores")
      .select("id, user_id, game_type, score, metadata, achieved_at")
      .eq("user_id", user.id)
      .eq("game_type", "lane_runner")
      .order("achieved_at", { ascending: false })
      .limit(1);

    if (scoreErr) throw new Error(scoreErr.message);
    const row = scores?.[0];
    if (!row) {
      throw new Error("No lane_runner game_scores row after game over.");
    }

    const isNew =
      !before.data?.length ||
      row.id !== before.data[0]?.id ||
      new Date(row.achieved_at) > new Date(before.data[0]?.achieved_at ?? 0);

    console.log(
      JSON.stringify(
        {
          ok: true,
          coinMoved,
          gateSampleText: gateText.trim().slice(0, 80),
          scoreRow: row,
          newScoreSinceTestStart: isNew,
        },
        null,
        2
      )
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
