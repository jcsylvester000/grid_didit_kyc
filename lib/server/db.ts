import "server-only";
import { neon, neonConfig, type NeonQueryFunction } from "@neondatabase/serverless";
import { env } from "./env";
import { SCHEMA_STATEMENTS } from "./schema";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DEMO_VERIFIED } from "@/lib/data";

let client: NeonQueryFunction<false, false> | null = null;
let ready: Promise<void> | null = null;

function getClient() {
  const url = env.databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local (local) or Netlify env vars.");
  if (!client) {
    // Local test hook only: point the driver at a Neon-compatible HTTP endpoint (never set in production).
    if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;
    client = neon(url);
  }
  return client;
}

async function migrate() {
  const sql = getClient();
  for (const stmt of SCHEMA_STATEMENTS) await sql.query(stmt);
  const { hashPassword } = await import("./auth");
  for (const u of DEMO_ACCOUNTS) {
    await sql.query(
      `INSERT INTO kyc_users (id, display_name, email, role) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [u.id, u.name, u.email, u.role],
    );
    // Demo accounts get the shared demo password once (left alone if already set).
    await sql.query(`UPDATE kyc_users SET password_hash = $2 WHERE id = $1 AND password_hash IS NULL`, [u.id, await hashPassword(DEMO_PASSWORD)]);
  }
  await seedReturningTenant();
}

/** Seed passed checks (sample data) for Paolo (reuse demo), Ramon (owner) and Liza (broker). */
export async function seedReturningTenant() {
  const sql = getClient();
  for (const d of DEMO_VERIFIED) {
    await sql.query(
      `INSERT INTO kyc_verifications
         (user_id, trigger_action, id_type_chosen, mode, didit_status, outcome,
          verified_name, date_of_birth, document_type, document_expiry, issuing_state, decided_at, created_at)
       SELECT $1, 'seed', $2, 'seed', 'Approved', 'verified', $3, $4::date, $5, (now() + interval '3 years')::date, 'PHL',
              now() - interval '30 days', now() - interval '30 days'
       WHERE NOT EXISTS (SELECT 1 FROM kyc_verifications WHERE user_id = $1)`,
      [d.userId, d.idType, d.name, d.dob, d.docType],
    );
  }
}

/** Run a parameterised query. Schema is created once per server instance. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const sql = getClient();
  if (!ready) ready = migrate().catch((e) => { ready = null; throw e; });
  await ready;
  return (await sql.query(text, params)) as T[];
}

export async function q1<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export const dbConfigured = () => Boolean(env.databaseUrl());
