import { defineConfig, devices } from "@playwright/test";
import argon2 from "argon2";
const password = "six123";
const hash = await argon2.hash(password);
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      PHOTOBOOTH_E2E: "1",
      // All fixture env is supplied here; never merge the operator's .env.local.
      __NEXT_PROCESSED_ENV: "true",
      STORAGE_MODE: "mock",
      NEXT_PUBLIC_APP_URL: "http://localhost:3100",
      ADMIN_PASSWORD_HASH: hash,
      ADMIN_SESSION_SECRET:
        "e2e-only-session-secret-123456789012345678901234567890",
    },
  },
});
