import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { clientEnv } from "@/env/client";

// Optimistic routing only — NOT authorization. Pages (require*), actions and
// RLS enforce access on their own (docs/SECURITY.md).
const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/check-email"];
const SIGNED_IN_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/orgs",
  "/account",
  "/reset-password",
  "/o/",
];

function matches(pathname: string, prefixes: readonly string[]) {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`),
  );
}

/**
 * Refreshes the Supabase session cookie on each request, then sends signed-out
 * visitors to /login and signed-in visitors away from the auth pages.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Cache-control headers that stop CDNs caching responses carrying auth cookies.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Validates the JWT and refreshes it if expired. Do not run code between
  // client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname, search } = request.nextUrl;
  let target: string | null = null;
  if (pathname === "/") {
    target = signedIn ? "/dashboard" : "/login";
  } else if (signedIn && matches(pathname, AUTH_PAGES)) {
    target = "/dashboard";
  } else if (!signedIn && matches(pathname, SIGNED_IN_PREFIXES)) {
    target =
      pathname === "/dashboard"
        ? "/login"
        : `/login?next=${encodeURIComponent(pathname + search)}`;
  }

  if (!target) return response;

  // Carry any refreshed session cookies over to the redirect.
  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const h of ["cache-control", "expires", "pragma"]) {
    const v = response.headers.get(h);
    if (v) redirect.headers.set(h, v);
  }
  return redirect;
}

export const config = {
  matcher: [
    // Skip static assets and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
