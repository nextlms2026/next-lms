import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

test("a failed or cancelled Google sign-in returns to sign-in with an error", async ({
  page,
}) => {
  for (const url of [
    "/auth/callback?error=access_denied&error_description=cancelled",
    "/auth/callback?code=not-a-real-code",
    "/auth/callback",
  ]) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/login\?error=oauth$/);
    await expect(
      page.getByRole("alert").filter({ hasText: /\S/ }),
    ).toContainText("Google sign-in did not complete");
  }
});

test("the Google button follows the feature flag", async ({ page }) => {
  await page.goto("/login");
  const button = page.getByRole("button", { name: "Continue with Google" });
  if (!googleEnabled) {
    await expect(button).toHaveCount(0);
    return;
  }
  // Enabled: the button hands off to Google's account chooser.
  await button.click();
  await page.waitForURL(/accounts\.google\.com/, { timeout: 15_000 });
});
