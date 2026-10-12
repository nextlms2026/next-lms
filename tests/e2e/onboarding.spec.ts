import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createE2EUser, deleteE2EUser, type E2EUser } from "./support";

// Optional design-review screenshots: SCREENSHOT_DIR=... npm run test:e2e
const shotDir = process.env.SCREENSHOT_DIR;
async function shot(page: Page, name: string) {
  if (!shotDir) return;
  const dir = path.join(shotDir, test.info().project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: path.join(dir, `${name}.png`),
    fullPage: true,
  });
}

let user: E2EUser;

test.beforeAll(async ({}, info) => {
  user = await createE2EUser(info.project.name);
});

test.afterAll(async () => {
  if (user) await deleteE2EUser(user);
});

test("signed-out visitors land on sign-in, keeping where they were going", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/o/some-workspace/settings");
  await expect(page).toHaveURL(
    /\/login\?next=%2Fo%2Fsome-workspace%2Fsettings$/,
  );
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login\?next=%2Fonboarding$/);
});

test("email links show the right outcome for each case", async ({ page }) => {
  // Default Supabase template: Supabase already verified the email, but the
  // session step fails (e.g. opened on another device) → confirmed, sign in.
  await page.goto("/auth/confirm?code=not-a-real-code&next=/dashboard");
  await expect(page).toHaveURL(/\/login\?notice=confirmed$/);
  await expect(page.getByRole("status")).toHaveText(
    "Your email is confirmed. Sign in to continue.",
  );

  // Supabase rejected the link (expired / already used).
  await page.goto("/auth/confirm?error=access_denied&error_code=otp_expired");
  await expect(page).toHaveURL(/\/login\?error=link$/);
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(
    "expired or was already used",
  );

  // A recovery link that can't establish a session is a real failure.
  await page.goto("/auth/confirm?code=not-a-real-code&next=/reset-password");
  await expect(page).toHaveURL(/\/login\?error=link$/);

  // Unusable token_hash.
  await page.goto("/auth/confirm?token_hash=bogus&type=email");
  await expect(page).toHaveURL(/\/login\?error=link$/);
});

test("rejects wrong credentials without revealing which part was wrong", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /\S/ }), // skip Next's empty route announcer
  ).toHaveText("Incorrect email or password.");
  await expect(page.getByLabel("Email")).toHaveValue(user.email);
});

test("sign in → create workspace → Today → settings → sign out", async ({
  page,
}) => {
  await page.goto("/signup");
  await shot(page, "02-signup");

  await page.goto("/login");
  await shot(page, "03-login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // No workspace yet → onboarding, with regional fields prefilled from the browser.
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel("Time zone")).not.toHaveValue("");
  await page.getByLabel("Workspace name").fill("Esha's Physics Classes");
  await page.getByLabel("Type").selectOption("institute");
  await page.getByLabel("Country").selectOption("LK");
  await expect(page.getByLabel("Currency")).toHaveValue("LKR");
  await page.getByLabel("Time zone").selectOption("Asia/Colombo");
  await shot(page, "04-onboarding");
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(page).toHaveURL(/\/o\/esha-s-physics-classes(-[a-z0-9]{4})?$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Welcome, Esha",
  );
  await expect(page.getByText("No classes scheduled today")).toBeVisible();
  await shot(page, "05-today");
  const orgUrl = page.url();

  // Owner can edit settings.
  await page.goto(`${orgUrl}/settings`);
  await page.getByLabel("Workspace name").fill("Esha Physics");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await shot(page, "06-settings");

  // A workspace the user doesn't belong to looks exactly like a missing one.
  await page.goto("/o/not-my-workspace-zz");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(page.getByText("Esha Physics")).toHaveCount(0);

  // Signed-in users skip the auth pages and the root.
  await page.goto("/login");
  await expect(page).toHaveURL(orgUrl);
  await page.goto("/");
  await expect(page).toHaveURL(orgUrl);

  // Account page.
  await page.goto("/account");
  await expect(page.getByLabel("Full name")).toHaveValue(user.fullName);
  await shot(page, "07-account");

  // Sign out via the user menu.
  await page.goto(orgUrl);
  await page.getByRole("button", { name: "Your account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(orgUrl);
  await expect(page).toHaveURL(/\/login\?next=%2Fo%2F/);
});
