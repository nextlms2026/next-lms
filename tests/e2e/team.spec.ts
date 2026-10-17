import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  createE2EOrg,
  createE2EUser,
  deleteE2EUser,
  inviteLinkFrom,
  latestEmailTo,
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

test("owner emails an invitation (and resends); teacher joins with limited access; owner deactivates", async ({
  browser,
}) => {
  const ownerCtx = await browser.newContext();
  const teacherCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  const teacherPage = await teacherCtx.newPage();
  const orgPath = `/o/${org.slug}`;

  // --- Owner sends an invitation; it is emailed automatically.
  await ownerPage.goto(`${orgPath}/team`);
  await signIn(ownerPage, owner);
  await expect(ownerPage).toHaveURL(new RegExp(`${orgPath}/team$`));
  await ownerPage.getByLabel("Email address").fill(teacher.email);
  await ownerPage.getByLabel("Role").selectOption("teacher");
  await ownerPage.getByRole("button", { name: "Send invitation" }).click();
  await expect(ownerPage.getByRole("status")).toContainText(
    `Invitation emailed to ${teacher.email} as Teacher`,
  );
  const linkBox = ownerPage.getByLabel("Invitation link");
  const firstLink = await linkBox.inputValue();
  const firstEmail = await latestEmailTo(teacher.email);
  expect(firstEmail.subject).toBe(
    `${owner.fullName} invited you to ${org.name} on next-lms`,
  );
  expect(inviteLinkFrom(firstEmail)).toBe(firstLink); // same link in UI and email
  await shot(ownerPage, "10-team-invite-emailed");

  // --- Resend: a fresh link is emailed and the old one stops working.
  await ownerPage.reload();
  const pendingRow = ownerPage
    .getByRole("listitem")
    .filter({ hasText: teacher.email });
  await pendingRow.getByRole("button", { name: "Resend" }).click();
  await expect(ownerPage.getByRole("status")).toContainText(
    `A new invitation was emailed to ${teacher.email}`,
  );
  const link = inviteLinkFrom(await latestEmailTo(teacher.email));
  expect(link).not.toBe(firstLink);
  await teacherPage.goto(new URL(firstLink).pathname);
  await expect(
    teacherPage.getByRole("heading", { name: "Invitation cancelled" }),
  ).toBeVisible();

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
