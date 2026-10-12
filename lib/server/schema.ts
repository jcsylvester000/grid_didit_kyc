// Neon schema for GRID Verified. Idempotent: safe to run on every cold start and from scripts/migrate.ts.
// Privacy rule (Readiness Report §4.4): store RESULTS only. Never ID photos, selfies, face data,
// document numbers or PhilSys numbers (PCN/PSN). Those stay with Didit under its retention settings.

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS kyc_users (
     id text PRIMARY KEY,
     display_name text NOT NULL,
     email text NOT NULL,
     role text NOT NULL DEFAULT 'tenant',
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS kyc_consents (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id text NOT NULL REFERENCES kyc_users(id) ON DELETE CASCADE,
     purpose text NOT NULL,
     wording_version text NOT NULL,
     listing_id text,
     user_agent text,
     accepted_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS kyc_verifications (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id text NOT NULL REFERENCES kyc_users(id) ON DELETE CASCADE,
     consent_id uuid REFERENCES kyc_consents(id) ON DELETE SET NULL,
     trigger_action text NOT NULL,
     listing_id text,
     id_type_chosen text,
     mode text NOT NULL,
     didit_session_id text UNIQUE,
     didit_session_number bigint,
     workflow_id text,
     didit_status text,
     outcome text NOT NULL,
     verified_name text,
     date_of_birth date,
     document_type text,
     document_expiry date,
     issuing_state text,
     failure_reason text,
     reviewed_by text,
     review_note text,
     reviewed_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     decided_at timestamptz
   )`,
  `CREATE INDEX IF NOT EXISTS kyc_verifications_user_idx ON kyc_verifications (user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS kyc_verifications_outcome_idx ON kyc_verifications (outcome)`,
  `CREATE TABLE IF NOT EXISTS kyc_webhook_events (
     event_id text PRIMARY KEY,
     session_id text,
     webhook_type text,
     status text,
     signature_method text,
     processed boolean NOT NULL DEFAULT false,
     received_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS kyc_bookings (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id text NOT NULL REFERENCES kyc_users(id) ON DELETE CASCADE,
     listing_id text NOT NULL,
     slot text NOT NULL,
     verification_id uuid REFERENCES kyc_verifications(id) ON DELETE SET NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (user_id, listing_id, slot)
   )`,
  `CREATE TABLE IF NOT EXISTS kyc_audit_log (
     id bigserial PRIMARY KEY,
     at timestamptz NOT NULL DEFAULT now(),
     actor text NOT NULL,
     action text NOT NULL,
     user_id text,
     verification_id uuid,
     detail jsonb NOT NULL DEFAULT '{}'::jsonb
   )`,
  `CREATE INDEX IF NOT EXISTS kyc_audit_log_at_idx ON kyc_audit_log (at DESC)`,
  `CREATE TABLE IF NOT EXISTS kyc_settings (
     key text PRIMARY KEY,
     value jsonb NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
];
