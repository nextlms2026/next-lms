import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./config";

// When more locales arrive, resolve the locale from the user's profile / org
// default here — no URL-based locale routing.
export default getRequestConfig(async () => ({
  locale: defaultLocale,
  messages: (await import(`../../messages/${defaultLocale}.json`)).default,
}));
