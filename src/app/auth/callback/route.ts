import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/server/supabase";
import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * Return point for OAuth sign-in (Google). Unlike email links (/auth/confirm),
 * a failed exchange here is a real failure: nothing was verified.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const to = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));
  const next = safeRedirectPath(searchParams.get("next"), "/dashboard");
  const code = searchParams.get("code");

  // Provider error or the user cancelled on Google's screen.
  if (searchParams.get("error") || !code) {
    return to("/login?error=oauth");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return to(error ? "/login?error=oauth" : next);
}
