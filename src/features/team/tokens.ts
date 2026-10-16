import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 256-bit random, URL-safe. Shown once in the invite link; never stored. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What the database stores and looks up (invitations.token_hash). */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cheap shape check before touching the database. */
export function isPlausibleInviteToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function inviteUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/invite/${token}`;
}
