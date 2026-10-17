import { afterEach, describe, expect, it } from "vitest";
import {
  buildInvitationEmail,
  escapeHtml,
  type InvitationEmailCopy,
} from "@/features/team/emails/invitation";
import { isEmailEnabled, resetEmailForTests, sendEmail } from "@/server/email";

const copy: InvitationEmailCopy = {
  subject: "Olivia invited you to <script>alert(1)</script> Tuition",
  heading: 'Join "Lotus" & Co',
  intro: "Olivia has invited you as Teacher.",
  button: "Accept invitation",
  expiry: "Expires in 7 days.",
  fallback: "Copy this link:",
  ignore: "Ignore if unexpected.",
};
const link = "https://app.example/invite/abcDEF123_-";

describe("invitation email", () => {
  it("escapes user-controlled text in the HTML body", () => {
    const msg = buildInvitationEmail("t@example.com", link, {
      ...copy,
      heading: "Join <img src=x onerror=alert(1)> Tuition",
    });
    expect(msg.html).not.toContain("<img src=x");
    expect(msg.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    // The subject is a mail header (not HTML) and is passed through as text.
    expect(msg.subject).toBe(copy.subject);
  });

  it("includes the link (button + fallback) and expiry in HTML and text", () => {
    const msg = buildInvitationEmail("t@example.com", link, copy);
    expect(msg.to).toBe("t@example.com");
    expect(msg.html.match(new RegExp(link, "g"))).toHaveLength(3); // href ×2 + visible text
    expect(msg.text).toContain(link);
    expect(msg.text).toContain("Expires in 7 days.");
  });

  it("escapes all five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe("sendEmail", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    resetEmailForTests();
  });

  const message = {
    to: "t@example.com",
    subject: "s",
    html: "<p>h</p>",
    text: "h",
  };

  it("is disabled (not an error) when no transport is configured", async () => {
    delete process.env.EMAIL_TRANSPORT;
    resetEmailForTests();
    expect(isEmailEnabled()).toBe(false);
    expect(await sendEmail(message)).toEqual({ ok: false, reason: "disabled" });
  });

  it("reports misconfiguration instead of throwing", async () => {
    process.env.EMAIL_TRANSPORT = "smtp";
    delete process.env.SMTP_HOST;
    resetEmailForTests();
    expect(await sendEmail(message)).toEqual({
      ok: false,
      reason: "misconfigured",
    });
  });

  it("returns failed (never throws) when the SMTP server is unreachable", async () => {
    Object.assign(process.env, {
      EMAIL_TRANSPORT: "smtp",
      EMAIL_FROM: "next-lms <a@example.com>",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1",
      SMTP_USER: "u",
      SMTP_PASSWORD: "p",
    });
    resetEmailForTests();
    expect(await sendEmail(message)).toEqual({ ok: false, reason: "failed" });
  });
});
