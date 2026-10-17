import type { EmailMessage } from "@/server/email";

/** Already-translated copy (messages/en.json → emails.invitation). Plain text, unescaped. */
export type InvitationEmailCopy = {
  subject: string;
  heading: string;
  intro: string;
  button: string;
  expiry: string;
  fallback: string;
  ignore: string;
};

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Org and inviter names are user input: escape everything that reaches HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

export function buildInvitationEmail(
  to: string,
  link: string,
  copy: InvitationEmailCopy,
): EmailMessage {
  const e = escapeHtml;
  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;background:#f6f8fa;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2933">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e3e8ee;border-radius:12px;padding:32px">
        <tr><td>
          <p style="margin:0 0 24px;font-weight:600;font-size:16px;color:#0b5c75">next-lms</p>
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${e(copy.heading)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6">${e(copy.intro)}</p>
          <p style="margin:0 0 24px">
            <a href="${e(link)}" style="display:inline-block;background:#0b5c75;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">${e(copy.button)}</a>
          </p>
          <p style="margin:0 0 16px;font-size:13px;color:#5b6773">${e(copy.expiry)}</p>
          <p style="margin:0 0 4px;font-size:13px;color:#5b6773">${e(copy.fallback)}</p>
          <p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${e(link)}" style="color:#0b5c75">${e(link)}</a></p>
          <p style="margin:0;font-size:12px;color:#8a96a3">${e(copy.ignore)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    copy.heading,
    "",
    copy.intro,
    "",
    `${copy.button}: ${link}`,
    "",
    copy.expiry,
    "",
    copy.ignore,
  ].join("\n");

  return { to, subject: copy.subject, html, text };
}
