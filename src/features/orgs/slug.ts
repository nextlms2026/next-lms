/**
 * URL slug for an organisation: lowercase ASCII letters, digits and hyphens,
 * 3–48 chars (matches the organizations_slug_format DB constraint).
 * Non-Latin names (e.g. Sinhala, Arabic) produce no ASCII, so we fall back.
 */
export function slugify(name: string, fallback = "workspace"): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : fallback;
}

/** Appends a short random suffix, used when a slug is already taken. */
export function withSuffix(slug: string, random: () => number = Math.random) {
  const suffix = Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  return `${slug.slice(0, 43)}-${suffix}`;
}
