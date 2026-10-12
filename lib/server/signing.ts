import { createHmac, timingSafeEqual } from "node:crypto";

// Cookie signing shared by server components, actions and proxy.ts. No Next.js imports here.
const secret = () => process.env.SESSION_SECRET || (process.env.NODE_ENV !== "production" ? "dev-only-insecure-secret" : "");

const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const signedValue = (value: string) => `${value}.${sign(value)}`;

export function readSigned(raw: string | undefined): string | null {
  if (!raw || !secret()) return null;
  const i = raw.lastIndexOf(".");
  if (i < 1) return null;
  const value = raw.slice(0, i);
  return safeEqual(raw.slice(i + 1), sign(value)) ? value : null;
}

export const ACCESS_COOKIE = "gv_access";
export const ACCESS_GRANTED = "granted";
