import "server-only";
import { cookies } from "next/headers";
import { env } from "./env";
import { ACCESS_COOKIE, ACCESS_GRANTED, readSigned, safeEqual, signedValue } from "./signing";

export { readSigned, signedValue };
import { DEFAULT_USER_ID, getDemoUser, type DemoUser } from "@/lib/data";

// Prototype identity: a signed cookie picks one of the demo users. Production would use real auth.
const USER_COOKIE = "gv_uid";
const ADMIN_COOKIE = "gv_admin";

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

/* ---------------------------------------------------------------- internal access gate */

// Internal prototype: every page sits behind an access code. Client-requested default 412099;
// APP_ACCESS_CODE overrides it (set a different value in Netlify for anything shared wider).
const accessCode = () => process.env.APP_ACCESS_CODE || "412099";

export async function hasAccess(): Promise<boolean> {
  if (!env.sessionSecret()) return false;
  const jar = await cookies();
  return readSigned(jar.get(ACCESS_COOKIE)?.value) === ACCESS_GRANTED;
}

export function checkAccessCode(code: string) {
  return safeEqual(code.trim(), accessCode());
}

export async function grantAccess() {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, signedValue(ACCESS_GRANTED), {
    httpOnly: true,
    sameSite: "lax", // must survive the redirect back from Didit
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function revokeAccess() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
}
