import { redirect } from "next/navigation";

// "/" is routed by src/proxy.ts (sign-in or dashboard). This is only a fallback.
// A public marketing site, if needed later, should live outside the app.
export default function Home() {
  redirect("/login");
}
