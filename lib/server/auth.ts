import "server-only";
import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { q, q1 } from "./db";
import type { Role } from "@/lib/data";

// Prototype accounts. Passwords are hashed with scrypt (Node built-in), never stored or logged in plain text.
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored?.startsWith("scrypt$")) return false;
  const [, saltB64, hashB64] = stored.split("$");
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type AppUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  created_at: string;
  last_login_at: string | null;
};

const USER_COLS = `id, display_name AS name, email, phone, role, created_at, last_login_at`;

export const getUser = (id: string) => q1<AppUser>(`SELECT ${USER_COLS} FROM kyc_users WHERE id = $1`, [id]);

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

/** Philippine mobile, e.g. 0917 123 4567 or +63 917 123 4567 → +639171234567. Returns null if invalid. */
export function normalizePhMobile(raw: string): string | null {
  const d = raw.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(d)) return "+63" + d.slice(1);
  if (/^\+639\d{9}$/.test(d)) return d;
  if (/^639\d{9}$/.test(d)) return "+" + d;
  return null;
}

export async function createUser(input: { name: string; email: string; phone: string | null; password: string; role: Role }) {
  const id = `usr_${randomUUID()}`;
  const row = await q1<AppUser>(
    `INSERT INTO kyc_users (id, display_name, email, phone, role, password_hash, last_login_at)
     VALUES ($1,$2,$3,$4,$5,$6, now())
     ON CONFLICT DO NOTHING
     RETURNING ${USER_COLS}`,
    [id, input.name, normalizeEmail(input.email), input.phone, input.role, await hashPassword(input.password)],
  );
  return row; // null when the email is already registered
}

export async function authenticate(email: string, password: string) {
  const row = await q1<AppUser & { password_hash: string | null }>(
    `SELECT ${USER_COLS}, password_hash FROM kyc_users WHERE lower(email) = $1`,
    [normalizeEmail(email)],
  );
  // Always run one scrypt so response time doesn't reveal whether the email exists.
  const ok = await verifyPassword(password, row?.password_hash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86));
  if (!row || !ok) return null;
  await q(`UPDATE kyc_users SET last_login_at = now() WHERE id = $1`, [row.id]);
  const { password_hash: _omit, ...user } = row;
  return user as AppUser;
}

export const listUsers = () =>
  q<AppUser & { kyc_outcome: string | null; bookings: number }>(
    `SELECT u.id, u.display_name AS name, u.email, u.phone, u.role, u.created_at, u.last_login_at,
            (SELECT v.outcome FROM kyc_verifications v WHERE v.user_id = u.id ORDER BY v.created_at DESC LIMIT 1) AS kyc_outcome,
            (SELECT count(*)::int FROM kyc_bookings b WHERE b.user_id = u.id) AS bookings
     FROM kyc_users u ORDER BY u.created_at DESC LIMIT 100`,
  );
