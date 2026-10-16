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

async function signIn(page: Page, user: E2EUser) {
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

let owner: E2EUser;
let teacher: E2EUser;
let org: { slug: string; name: string };

test.beforeAll(async ({}, info) => {
  owner = await createE2EUser(`${info.project.name}-owner`, "Olivia Owner");
  teacher = await createE2EUser(
    `${info.project.name}-teacher`,
    "Tharindu Teacher",
  );
  org = await createE2EOrg(owner, "Lotus Tuition Centre");
});

test.afterAll(async () => {
  // Org is owned (created_by) by the owner, so deleting the owner's orgs first
  // removes the teacher's membership too.
  if (owner) await deleteE2EUser(owner);
  if (teacher) await deleteE2EUser(teacher);
});

test("owner invites a teacher by link; teacher joins with limited access; owner deactivates", async ({
  browser,
}) => {
  const ownerCtx = await browser.newContext();
  const teacherCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  const teacherPage = await teacherCtx.newPage();
  const orgPath = `/o/${org.slug}`;

  // --- Owner creates an invite link.
  await ownerPage.goto(`${orgPath}/team`);
  await signIn(ownerPage, owner);
  await expect(ownerPage).toHaveURL(new RegExp(`${orgPath}/team$`));
  await ownerPage.getByLabel("Email address").fill(teacher.email);
  await ownerPage.getByLabel("Role").selectOption("teacher");
  await ownerPage.getByRole("button", { name: "Create invite link" }).click();
  const linkBox = ownerPage.getByLabel("Invitation link");
  await expect(linkBox).toHaveValue(/\/invite\/[A-Za-z0-9_-]{43}$/);
  const link = await linkBox.inputValue();
  await shot(ownerPage, "10-team-invite-link");

  await ownerPage.reload();
  await expect(ownerPage.getByText(teacher.email)).toBeVisible(); // pending list

  // --- Teacher opens the link signed out, signs in, accepts.
  await teacherPage.goto(new URL(link).pathname);
  await expect(
    teacherPage.getByRole("heading", { name: `Join ${org.name}` }),
  ).toBeVisible();
  await shot(teacherPage, "11-invite-signed-out");
  await teacherPage.getByRole("link", { name: "Sign in to accept" }).click();
  await signIn(teacherPage, teacher);
  await expect(teacherPage).toHaveURL(new RegExp("/invite/"));
  await teacherPage.getByRole("button", { name: "Accept invitation" }).click();
  await expect(teacherPage).toHaveURL(new RegExp(`${orgPath}$`));

  // Teacher sees Team but not Activity; Activity URL is a 404 for them.
  const nav = teacherPage.getByRole("navigation").first();
  await teacherPage.setViewportSize({ width: 1280, height: 800 });
  await expect(nav.getByRole("link", { name: "Team" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Activity" })).toHaveCount(0);
  await teacherPage.goto(`${orgPath}/activity`);
  await expect(
    teacherPage.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  // Teachers see names, not emails.
  await teacherPage.goto(`${orgPath}/team`);
  await expect(teacherPage.getByText(owner.fullName).first()).toBeVisible();
  await expect(teacherPage.getByText(owner.email)).toHaveCount(0);

  // The link is single-use.
  await teacherPage.goto(new URL(link).pathname);
  await expect(
    teacherPage.getByRole("heading", { name: "Invitation already used" }),
  ).toBeVisible();

  // --- Owner sees the new member and the activity, then deactivates them.
  await ownerPage.goto(`${orgPath}/activity`);
  await expect(ownerPage.getByText("joined as Teacher")).toBeVisible();
  await shot(ownerPage, "12-activity");

  await ownerPage.goto(`${orgPath}/team`);
  await expect(ownerPage.getByText(teacher.email)).toBeVisible();
  await shot(ownerPage, "13-team");
  await ownerPage
    .getByRole("button", {
      name: `Actions for ${teacher.fullName} · ${teacher.email}`,
    })
    .click();
  await ownerPage.getByRole("menuitem", { name: "Deactivate" }).click();
  await ownerPage
    .getByRole("alertdialog")
    .getByRole("button", { name: "Deactivate" })
    .click();
  await expect(ownerPage.getByText("Inactive")).toBeVisible();

  // Teacher immediately loses access.
  await teacherPage.goto(orgPath);
  await expect(
    teacherPage.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();

  await ownerCtx.close();
  await teacherCtx.close();
});
