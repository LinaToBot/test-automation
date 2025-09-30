import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: true,

  retries: 1,

  reporter: [["html", { open: "never" }]],

  use: {
    trace: "on",
    screenshot: "only-on-failure",
    video: "off",
    baseURL: "https://www.mercadolibre.com",
    locale: "es-MX",
    viewport: { width: 1366, height: 768 },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
