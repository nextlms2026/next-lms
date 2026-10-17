import { defineConfig, devices } from "@playwright/test";

// Tests run against a production build on its own port (fast, realistic, and
// does not collide with `npm run dev` on 3000). Override with E2E_BASE_URL.
const port = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Multi-step journeys make many round trips to the remote dev Supabase project.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Remote free-tier dev project: limit parallel load on Supabase Auth/DB.
  workers: 2,
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    // Students are mostly on phones (docs/UI-UX.md).
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- -p ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
        // Never send real email from tests: capture to .test-emails/ instead.
        // (process env overrides .env.local in Next.js.)
        env: { ...process.env, EMAIL_TRANSPORT: "test" },
      },
});
