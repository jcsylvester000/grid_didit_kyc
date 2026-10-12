import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";
import { DEFAULT_USER_ID, getDemoUser, type DemoUser } from "@/lib/data";

// Prototype identity: a signed cookie picks one of the demo users. Production would use real auth.
const USER_COOKIE = "gv_uid";
const ADMIN_COOKIE = "gv_admin";

const sign = (value: string) => createHmac("sha256", env.sessionSecret()).update(value).digest("base64url");

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const signedValue = (value: string) => `${value}.${sign(value)}`;

export function readSigned(raw: string | undefined): string | null {
  if (!raw || !env.sessionSecret()) return null;
  const i = raw.lastIndexOf(".");
  if (i < 1) return null;
  const value = raw.slice(0, i);
  return safeEqual(raw.slice(i + 1), sign(value)) ? value : null;
}

export async function currentUser(): Promise<DemoUser> {
  const jar = await cookies();
  const id = readSigned(jar.get(USER_COOKIE)?.value);
  return getDemoUser(id) ?? getDemoUser(DEFAULT_USER_ID)!;
}

export async function setCurrentUser(id: string) {
  const jar = await cookies();
  jar.set(USER_COOKIE, signedValue(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function isAdmin(): Promise<boolean> {
  if (!env.adminCode() || !env.sessionSecret()) return false;
  const jar = await cookies();
  return readSigned(jar.get(ADMIN_COOKIE)?.value) === "admin";
}

export function checkAdminCode(code: string) {
  const expected = env.adminCode();
  return Boolean(expected) && safeEqual(code, expected);
}

export async function setAdmin(on: boolean) {
  const jar = await cookies();
  if (!on) return jar.delete(ADMIN_COOKIE);
  jar.set(ADMIN_COOKIE, signedValue("admin"), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}
