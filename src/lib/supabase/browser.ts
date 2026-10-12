import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/env/client";

/** Browser Supabase client — Auth and Storage uploads only. Never holds privileged keys. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
