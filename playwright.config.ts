import { defineConfig, devices } from "@playwright/test";

const loopbackNoProxy = "localhost,127.0.0.1";
process.env.NO_PROXY = [process.env.NO_PROXY, loopbackNoProxy].filter(Boolean).join(",");
process.env.no_proxy = [process.env.no_proxy, loopbackNoProxy].filter(Boolean).join(",");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: "list",
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
