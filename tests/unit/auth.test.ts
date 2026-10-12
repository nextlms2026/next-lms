import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { resetPasswordSchema, signUpSchema } from "@/features/auth/schema";
import { profileSchema } from "@/features/profile/schema";

describe("safeRedirectPath", () => {
  it.each(["/dashboard", "/o/my-org/settings?tab=1", "/reset-password"])(
    "allows same-origin path %j",
    (p) => expect(safeRedirectPath(p, "/x")).toBe(p),
  );

  it.each([
    null,
    "",
    "dashboard",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/ok\\..\\evil",
    "/\u0000x",
    "javascript:alert(1)",
  ])("rejects %j", (p) =>
    expect(safeRedirectPath(p, "/fallback")).toBe("/fallback"),
  );
});

describe("signUpSchema", () => {
  it("normalises email and trims name", () => {
    const r = signUpSchema.parse({
      fullName: "  Nimali Perera ",
      email: " Nimali@Example.COM ",
      password: "correct horse",
    });
    expect(r).toMatchObject({
      fullName: "Nimali Perera",
      email: "nimali@example.com",
    });
  });

  it("enforces password length bounds", () => {
    const base = { fullName: "A", email: "a@b.co" };
    expect(
      signUpSchema.safeParse({ ...base, password: "short" }).error?.issues[0]
        ?.message,
    ).toBe("passwordTooShort");
    expect(
      signUpSchema.safeParse({ ...base, password: "x".repeat(73) }).error
        ?.issues[0]?.message,
    ).toBe("passwordTooLong");
  });
});

describe("resetPasswordSchema", () => {
  it("requires matching passwords", () => {
    const r = resetPasswordSchema.safeParse({
      password: "a-long-password",
      confirmPassword: "different-one",
    });
    expect(r.error?.issues[0]).toMatchObject({
      path: ["confirmPassword"],
      message: "passwordsDontMatch",
    });
  });
});

describe("profileSchema", () => {
  it("normalises phone formatting to E.164", () => {
    expect(
      profileSchema.parse({ fullName: "A", phone: "+94 77 123-4567" }).phone,
    ).toBe("+94771234567");
  });

  it("treats an empty phone as null", () => {
    expect(
      profileSchema.parse({ fullName: "A", phone: "  " }).phone,
    ).toBeNull();
  });

  it("rejects local-format numbers", () => {
    expect(
      profileSchema.safeParse({ fullName: "A", phone: "0771234567" }).error
        ?.issues[0]?.message,
    ).toBe("invalidPhone");
  });
});
