import "server-only";
import { serverEnvSchema } from "./schema";

export { clientEnv } from "./client";

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Report variable names only; never print values.
  const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Invalid or missing server environment variables: ${names}`);
}

export const serverEnv = parsed.data;
