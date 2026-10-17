import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { emailEnvSchema, type EmailEnv } from "@/env/schema";

/**
 * Outgoing email (ADR-017). Provider-independent: SMTP covers Gmail now and
 * Resend/SES later by changing env only. Callers get a result, never a throw,
 * and nothing here logs recipients, links or message bodies.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendResult =
  { ok: true } | { ok: false; reason: "disabled" | "misconfigured" | "failed" };

let cached:
  { env: EmailEnv | null; transporter: Transporter | null } | undefined;

function setup() {
  if (cached) return cached;
  const parsed = emailEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("email: invalid configuration", {
      fields: parsed.error.issues.map((i) => i.path.join(".")),
    });
    cached = { env: null, transporter: null };
    return cached;
  }
  const env = parsed.data;
  let transporter: Transporter | null = null;
  if (env.EMAIL_TRANSPORT === "smtp") {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // 465 = implicit TLS; 587 upgrades via STARTTLS
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
  } else if (env.EMAIL_TRANSPORT === "test") {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  cached = { env, transporter };
  return cached;
}

/** True when invitations etc. can be emailed (otherwise share-a-link only). */
export function isEmailEnabled(): boolean {
  return setup().transporter !== null;
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const { env, transporter } = setup();
  if (!env) return { ok: false, reason: "misconfigured" };
  if (!transporter) return { ok: false, reason: "disabled" };

  const from = env.EMAIL_FROM ?? "next-lms <no-reply@localhost>";
  try {
    const info = await transporter.sendMail({ from, ...message });
    if (env.EMAIL_TRANSPORT === "test") await captureForTests(info.message);
    return { ok: true };
  } catch (e) {
    const { code, responseCode } = e as {
      code?: string;
      responseCode?: number;
    };
    console.error("email: send failed", { code, responseCode });
    return { ok: false, reason: "failed" };
  }
}

/** E2E only: one JSON file per message in .test-emails/. */
async function captureForTests(json: unknown) {
  const dir = path.join(process.cwd(), ".test-emails");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, `${Date.now()}-${randomUUID()}.json`),
    typeof json === "string" ? json : JSON.stringify(json),
  );
}

/** Test hook: re-read env on next send. */
export function resetEmailForTests() {
  cached = undefined;
}
