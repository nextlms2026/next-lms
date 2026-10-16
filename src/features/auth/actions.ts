"use server";

import { redirect } from "next/navigation";
import { clientEnv } from "@/env/client";
import { createSupabaseServerClient } from "@/server/supabase";
import { requireUser } from "@/server/authz";
import { echoValues, fieldErrorsFrom, type FormState } from "@/lib/form-state";
import { safeRedirectPath } from "@/lib/safe-redirect";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./schema";

// Auth errors are mapped to generic message keys. We never reveal whether an
// email is registered (account enumeration) and never echo passwords.

function isRateLimited(code: string | undefined) {
  return (
    code === "over_request_rate_limit" || code === "over_email_send_rate_limit"
  );
}

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: echoValues(formData, ["email"]),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const key = isRateLimited(error.code)
      ? "rateLimited"
      : error.code === "email_not_confirmed"
        ? "emailNotConfirmed"
        : "invalidCredentials";
    return { ok: false, error: key, values: echoValues(formData, ["email"]) };
  }

  const next = formData.get("next");
  redirect(
    safeRedirectPath(typeof next === "string" ? next : null, "/dashboard"),
  );
}

export async function signUp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: echoValues(formData, ["fullName", "email"]),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      // Keeps e.g. an invitation link through email confirmation (default template).
      emailRedirectTo: `${clientEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=${encodeURIComponent(
        safeRedirectPath(nextFrom(formData), "/dashboard"),
      )}`,
    },
  });
  if (error) {
    const key = isRateLimited(error.code)
      ? "rateLimited"
      : error.code === "weak_password"
        ? "passwordTooWeak"
        : "signUpFailed";
    return {
      ok: false,
      error: key,
      values: echoValues(formData, ["fullName", "email"]),
    };
  }

  redirect("/check-email");
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${clientEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
    },
  );
  if (error && isRateLimited(error.code)) {
    return { ok: false, error: "rateLimited" };
  }
  // Same response whether or not the account exists.
  return { ok: true, message: "resetEmailSent" };
}

export async function updatePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser(); // recovery link establishes a session first
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    const key =
      error.code === "same_password"
        ? "samePassword"
        : error.code === "weak_password"
          ? "passwordTooWeak"
          : "generic";
    return { ok: false, error: key };
  }

  redirect("/dashboard");
}

export async function signOut(formData?: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const next = formData ? safeRedirectPath(nextFrom(formData), "") : "";
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
}

function nextFrom(formData: FormData): string | null {
  const v = formData.get("next");
  return typeof v === "string" && v ? v : null;
}

/**
 * Starts "Continue with Google" (Supabase OAuth, PKCE). Supabase sends the user
 * back to /auth/callback, which exchanges the code for a session.
 */
export async function signInWithGoogle(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!clientEnv.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED) {
    return { ok: false, error: "googleUnavailable" };
  }
  const next = safeRedirectPath(nextFrom(formData), "/dashboard");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${clientEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      // Let people with several Google accounts choose the right one.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    console.error("signInWithGoogle failed", { code: error?.code });
    return { ok: false, error: "googleUnavailable" };
  }
  redirect(data.url);
}
