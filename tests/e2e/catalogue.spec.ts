import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  createE2EOrg,
  createE2EUser,
  deleteE2EUser,
  type E2EUser,
} from "./support";

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

let owner: E2EUser;
let org: { slug: string; name: string };

test.beforeAll(async ({}, info) => {
  owner = await createE2EUser(`${info.project.name}-cat`, "Olivia Owner");
  org = await createE2EOrg(owner, "Lotus Tuition Centre"); // country LK
});

test.afterAll(async () => {
  if (owner) await deleteE2EUser(owner);
});

test("owner sets up grade levels, subjects and locations", async ({ page }) => {
  const base = `/o/${org.slug}/settings`;
  await page.goto(`${base}/grades`);
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Password").fill(owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/grades$`));

  // Grade system preselected from the org country (Sri Lanka).
  await expect(page.getByLabel("Grade system")).toHaveValue("lk");
  await shot(page, "20-grades-template");
  await page.getByRole("button", { name: "Add these grade levels" }).click();
  const grades = page.getByRole("listitem");
  await expect(
    grades.filter({ hasText: "A/L Year 2 (Grade 13)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add these grade levels" }),
  ).toHaveCount(0);

  // Reorder: move Grade 2 above Grade 1.
  await page.getByRole("button", { name: "Move Grade 2 up" }).click();
  await expect(grades.first()).toContainText("Grade 2");
  await shot(page, "21-grades");

  // Subjects: add, reject duplicate (case-insensitive), rename, archive, restore.
  await page.getByRole("link", { name: "Subjects" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/subjects$`));
  await page.getByLabel("Subject name").fill("Physics");
  await page.getByLabel("Code").fill("PHY");
  await page.getByRole("button", { name: "Add subject" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Physics" }),
  ).toBeVisible();

  await page.getByLabel("Subject name").fill("physics");
  await page.getByRole("button", { name: "Add subject" }).click();
  // Our Alert component (Next's route announcer also has role="alert").
  await expect(page.locator("[data-slot=alert]")).toContainText(
    "already exists",
  );

  await page.getByRole("button", { name: "Edit Physics" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Subject name").fill("Physics (A/L)");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
  const row = page.getByRole("listitem").filter({ hasText: "Physics (A/L)" });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("No subjects yet.")).toBeVisible();
  await page.getByRole("button", { name: "Show archived (1)" }).click();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Physics (A/L)" })
    .getByRole("button", { name: "Restore" })
    .click();
  // Restored: active again (can be archived), no archived items left.
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Physics (A/L)" })
      .getByRole("button", { name: "Archive" }),
  ).toBeVisible();
  await expect(page.getByText("Archived", { exact: true })).toHaveCount(0);
  // The earlier duplicate-name error must not linger after later actions.
  await expect(page.locator("[data-slot=alert]")).toHaveCount(0);
  await shot(page, "22-subjects");

  // Locations with a type.
  await page.getByRole("link", { name: "Locations" }).click();
  await page.getByLabel("Location name").fill("Zoom classroom");
  await page.getByLabel("Type").selectOption("online");
  await page.getByRole("button", { name: "Add location" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Zoom classroom" }),
  ).toContainText("Online");
  await shot(page, "23-locations");
});
