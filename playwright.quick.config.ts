import { defineConfig } from "@playwright/test";

import { QUICK_CHECK_BASE_URL } from "./tests/quick-checks/constants";

export default defineConfig({
  testDir: "./tests/quick-checks",
  timeout: 120_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: QUICK_CHECK_BASE_URL,
    browserName: "chromium",
    headless: true,
    trace: "on-first-retry",
    screenshot: "off",
    video: "off",
  },
});
