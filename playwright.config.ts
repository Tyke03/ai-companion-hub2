import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions: { args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dbus"] } },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 }, launchOptions: { args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dbus"] } },
    },
  ],

});