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
  // v0.3 accounts: password (scrypt hash), optional mobile, last login. Email unique (case-insensitive).
  `ALTER TABLE kyc_users ADD COLUMN IF NOT EXISTS password_hash text`,
  `ALTER TABLE kyc_users ADD COLUMN IF NOT EXISTS phone text`,
  `ALTER TABLE kyc_users ADD COLUMN IF NOT EXISTS last_login_at timestamptz`,
  `CREATE UNIQUE INDEX IF NOT EXISTS kyc_users_email_idx ON kyc_users (lower(email))`,
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
  // v0.4 document transactions (Authority to Sell). Grid's own workflow: Didit verifies the people and checks
  // the uploaded title copy; Grid builds the document, captures signatures, seals it (SHA-256) and keeps the trail.
  `CREATE TABLE IF NOT EXISTS kyc_documents (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     doc_type text NOT NULL DEFAULT 'ats',
     template_version text NOT NULL,
     status text NOT NULL,
     listing_id text NOT NULL,
     broker_id text NOT NULL REFERENCES kyc_users(id) ON DELETE CASCADE,
     owner_id text NOT NULL REFERENCES kyc_users(id) ON DELETE CASCADE,
     terms jsonb NOT NULL,
     parties jsonb NOT NULL DEFAULT '{}'::jsonb,
     title_check jsonb,
     content_hash text,
     final_hash text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     sent_at timestamptz,
     completed_at timestamptz
   )`,
  `CREATE INDEX IF NOT EXISTS kyc_documents_broker_idx ON kyc_documents (broker_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS kyc_documents_owner_idx ON kyc_documents (owner_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS kyc_face_checks (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id text NOT NULL REFERENCES kyc_users(id) ON DELETE CASCADE,
     document_id uuid NOT NULL REFERENCES kyc_documents(id) ON DELETE CASCADE,
     mode text NOT NULL,
     didit_session_id text UNIQUE,
     didit_session_number bigint,
     status text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     decided_at timestamptz
   )`,
  `CREATE TABLE IF NOT EXISTS kyc_document_signatures (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     document_id uuid NOT NULL REFERENCES kyc_documents(id) ON DELETE CASCADE,
     user_id text NOT NULL REFERENCES kyc_users(id) ON DELETE CASCADE,
     role text NOT NULL,
     signature_svg text NOT NULL,
     face_check_id uuid REFERENCES kyc_face_checks(id) ON DELETE SET NULL,
     signed_hash text NOT NULL,
     consent_text text NOT NULL,
     user_agent text,
     signed_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (document_id, role)
   )`,
  `CREATE TABLE IF NOT EXISTS kyc_document_events (
     id bigserial PRIMARY KEY,
     document_id uuid NOT NULL REFERENCES kyc_documents(id) ON DELETE CASCADE,
     at timestamptz NOT NULL DEFAULT now(),
     actor_id text,
     action text NOT NULL,
     detail jsonb NOT NULL DEFAULT '{}'::jsonb
   )`,
  `CREATE INDEX IF NOT EXISTS kyc_document_events_doc_idx ON kyc_document_events (document_id, at)`,
];
