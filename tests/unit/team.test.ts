import { describe, expect, it } from "vitest";
import {
  generateInviteToken,
  hashInviteToken,
  inviteUrl,
  isPlausibleInviteToken,
} from "@/features/team/tokens";
import { invitableRoles, memberActions } from "@/features/team/permissions";
import { inviteSchema } from "@/features/team/schema";
import { whatsappShareUrl } from "@/features/team/share";

describe("invite tokens", () => {
  it("are 256-bit, URL-safe and unique", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
    expect(isPlausibleInviteToken(a)).toBe(true);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
  });

  it("hash to the 64-char hex the DB constraint expects", () => {
    expect(hashInviteToken("x")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken("x")).toBe(hashInviteToken("x"));
  });

  it("rejects implausible tokens before hitting the DB", () => {
    for (const t of [
      "",
      "short",
      "../../etc/passwd",
      "a".repeat(44),
      "a b".repeat(15),
    ]) {
      expect(isPlausibleInviteToken(t)).toBe(false);
    }
  });

  it("builds links without double slashes", () => {
    expect(inviteUrl("https://app.example/", "tok")).toBe(
      "https://app.example/invite/tok",
    );
  });

  it("encodes WhatsApp share text", () => {
    expect(whatsappShareUrl("Join & go: https://x/y?z=1")).toBe(
      "https://wa.me/?text=Join%20%26%20go%3A%20https%3A%2F%2Fx%2Fy%3Fz%3D1",
    );
  });
});

describe("memberActions (UI mirror of SQL rules)", () => {
  const owner = { role: "owner" as const, membershipId: "o" };
  const admin = { role: "admin" as const, membershipId: "a" };
  const teacher = { role: "teacher" as const, membershipId: "t" };
  const target = (
    role: "owner" | "admin" | "teacher",
    status: "active" | "inactive" = "active",
  ) => ({
    membershipId: `target-${role}`,
    role,
    status,
  });

  it("owners can change roles and (de)activate anyone else", () => {
    expect(memberActions(owner, target("admin"))).toEqual({
      changeRole: true,
      deactivate: true,
      reactivate: false,
      leave: false,
    });
    expect(memberActions(owner, target("teacher", "inactive")).reactivate).toBe(
      true,
    );
  });

  it("admins manage teachers only and never change roles", () => {
    expect(memberActions(admin, target("teacher")).deactivate).toBe(true);
    expect(memberActions(admin, target("admin")).deactivate).toBe(false);
    expect(memberActions(admin, target("owner")).deactivate).toBe(false);
    expect(memberActions(admin, target("teacher")).changeRole).toBe(false);
  });

  it("teachers manage nobody", () => {
    expect(Object.values(memberActions(teacher, target("teacher")))).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("anyone can leave, nobody manages themselves", () => {
    const self = {
      membershipId: "o",
      role: "owner" as const,
      status: "active" as const,
    };
    expect(memberActions(owner, self)).toEqual({
      changeRole: false,
      deactivate: false,
      reactivate: false,
      leave: true,
    });
  });

  it("invitable roles follow the matrix", () => {
    expect(invitableRoles("owner")).toEqual(["teacher", "admin"]);
    expect(invitableRoles("admin")).toEqual(["teacher"]);
    expect(invitableRoles("teacher")).toEqual([]);
  });
});

describe("inviteSchema", () => {
  it("normalises email and refuses the owner role", () => {
    expect(
      inviteSchema.parse({ email: " A@B.co ", role: "teacher" }).email,
    ).toBe("a@b.co");
    expect(
      inviteSchema.safeParse({ email: "a@b.co", role: "owner" }).success,
    ).toBe(false);
  });
});
