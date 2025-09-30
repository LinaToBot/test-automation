import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Global timeout
  timeout: 90_000,
  expect: { timeout: 12_000 }, // ⬅ and the expect timeout

  // Run tests in parallel
  fullyParallel: true,

  // Retries if the public site shows intermittencies
  retries: 1,

  // Native HTML report from Playwright
  reporter: [["html", { open: "never" }]],

  use: {
    // Trace (includes video, network, timeline) — useful to deliver evidence
    trace: "on", // use 'on-first-retry' if you prefer lighter runs
    screenshot: "only-on-failure",
    video: "off", // trace already includes a lightweight video
    baseURL: "https://www.mercadolibre.com",
    locale: "es-MX",
    // default viewport
    viewport: { width: 1366, height: 768 },
  },

  // Runs in Chromium by default; you can add Safari/Firefox if needed
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
