import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/server/supabase";
import { emailOtpTypeSchema } from "@/features/auth/schema";
import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * Target of email links (signup confirmation, password recovery). Handles every
 * shape Supabase can send, depending on the email template:
 *
 *  1. `?token_hash=…&type=…` — our recommended template. Verified here, so the
 *     link works on any device/browser.
 *  2. `?code=…` — Supabase's default template. Supabase has ALREADY verified the
 *     email before redirecting here; we only exchange the code for a session.
 *     That exchange needs a cookie from the browser that started the flow, so it
 *     fails when the link is opened elsewhere — but the email is still confirmed.
 *  3. `?error=…&error_code=…` — Supabase rejected the link (expired / already used).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const to = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));

  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = emailOtpTypeSchema.safeParse(searchParams.get("type"));
  const requestedNext = searchParams.get("next");
  const isRecovery =
    (type.success && type.data === "recovery") ||
    requestedNext === "/reset-password";
  const next = safeRedirectPath(
    requestedNext,
    isRecovery ? "/reset-password" : "/dashboard",
  );

  // Recovery links must end in a signed-in session to set a new password;
  // for signup confirmation, a failed session step still means "confirmed".
  const failure = isRecovery ? "/login?error=link" : "/login?notice=confirmed";

  if (searchParams.get("error")) {
    // Expired or already used. If it was a signup link the user may well be
    // confirmed already (e.g. clicked twice), so the message covers both.
    return to("/login?error=link");
  }

  const supabase = await createSupabaseServerClient();

  if (tokenHash && type.success) {
    const { error } = await supabase.auth.verifyOtp({
      type: type.data,
      token_hash: tokenHash,
    });
    return to(error ? "/login?error=link" : next);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return to(error ? failure : next);
  }

  return to("/login?error=link");
}
