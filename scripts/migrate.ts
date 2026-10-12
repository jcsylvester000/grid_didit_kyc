// Run: npm run db:migrate   (reads DATABASE_URL from .env.local; Node 22.18+ runs .ts directly)
import { neon } from "@neondatabase/serverless";
import { SCHEMA_STATEMENTS } from "../lib/server/schema.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL is not set — skipping migration.");
  process.exit(0);
}
const sql = neon(url);
for (const stmt of SCHEMA_STATEMENTS) await sql.query(stmt);
console.log(`Migrated ${SCHEMA_STATEMENTS.length} statements.`);
