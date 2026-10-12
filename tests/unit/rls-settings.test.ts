import { describe, expect, it } from "vitest";
import { toRlsSettings } from "@/server/db/rls-settings";

describe("toRlsSettings", () => {
  it("maps signed-out callers to the anon role", () => {
    const s = toRlsSettings(null);
    expect(s.role).toBe("anon");
    expect(JSON.parse(s.claimsJson)).toEqual({ role: "anon" });
  });

  it("passes verified authenticated claims through", () => {
    const claims = { sub: "user-1", role: "authenticated", email: "a@b.c" };
    const s = toRlsSettings(claims);
    expect(s.role).toBe("authenticated");
    expect(JSON.parse(s.claimsJson)).toEqual(claims);
  });

  it.each(["service_role", "postgres", "anon", ""])(
    "refuses to run a token with role %j as authenticated",
    (role) => {
      expect(() => toRlsSettings({ sub: "user-1", role })).toThrow();
    },
  );

  it("rejects claims without a subject", () => {
    expect(() => toRlsSettings({ sub: "", role: "authenticated" })).toThrow();
  });
});
