import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Files allowed to import the RLS-bypassing admin DB client.
 * Must match docs/SECURITY.md → "Admin client". Keep this list short.
 */
const adminDbAllowlist = [];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/db/**", ...adminDbAllowlist],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/db/client", "**/server/db/client"],
              message: "Use `db.rls` from @/server/db (RLS-enforced).",
            },
            {
              group: ["@/server/db/admin", "**/server/db/admin"],
              message:
                "Admin DB bypasses RLS. Only allowlisted call sites (docs/SECURITY.md) may import it.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
