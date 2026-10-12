import "server-only";
import { randomUUID } from "node:crypto";
import { q, q1 } from "./db";
import { audit } from "./audit";
import { env, isMockMode } from "./env";
import {
  createDiditSession,
  getDiditDecision,
  DiditUnavailableError,
  type DiditDecision,
  type DiditIdVerification,
} from "./didit";
import { CONSENT_VERSION, getListing, idTypeLabel, type IdType } from "@/lib/data";
import type { AppUser } from "./auth";
import type { Outcome, VerificationRow } from "@/lib/types";

const COLS = `id, user_id, consent_id, trigger_action, listing_id, id_type_chosen, mode, didit_session_id,
  didit_session_number, didit_status, outcome, verified_name, to_char(date_of_birth,'YYYY-MM-DD') AS date_of_birth,
  document_type, to_char(document_expiry,'YYYY-MM-DD') AS document_expiry, issuing_state, failure_reason,
  reviewed_by, review_note, reviewed_at, created_at, updated_at, decided_at`;

/* ------------------------------------------------------------------ settings */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await q1<{ value: T }>(`SELECT value FROM kyc_settings WHERE key = $1`, [key]);
  return row ? row.value : fallback;
}
export async function setSetting(key: string, value: unknown) {
  await q(
    `INSERT INTO kyc_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}
export const isOutageSimulated = () => getSetting<boolean>("simulate_outage", false);

/* ------------------------------------------------------------------ reads */

export const getVerification = (id: string) =>
  /^[0-9a-f-]{36}$/i.test(id) ? q1<VerificationRow>(`SELECT ${COLS} FROM kyc_verifications WHERE id = $1`, [id]) : Promise.resolve(null);

export const getVerificationBySession = (sessionId: string) =>
  q1<VerificationRow>(`SELECT ${COLS} FROM kyc_verifications WHERE didit_session_id = $1`, [sessionId]);

export const latestVerification = (userId: string) =>
  q1<VerificationRow>(`SELECT ${COLS} FROM kyc_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [userId]);

/** Rule 2 — verify once, reuse everywhere: a passed check with an unexpired ID. */
export const findReusable = (userId: string) =>
  q1<VerificationRow>(
    `SELECT ${COLS} FROM kyc_verifications
     WHERE user_id = $1 AND outcome = 'verified' AND (document_expiry IS NULL OR document_expiry >= current_date)
     ORDER BY decided_at DESC NULLS LAST LIMIT 1`,
    [userId],
  );

export const userVerifications = (userId: string) =>
  q<VerificationRow>(`SELECT ${COLS} FROM kyc_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]);

/* ------------------------------------------------------------------ consent */

export async function recordConsent(userId: string, listingId: string | null, userAgent: string | null) {
  const row = await q1<{ id: string }>(
    `INSERT INTO kyc_consents (user_id, purpose, wording_version, listing_id, user_agent)
     VALUES ($1, 'identity_verification_book_viewing', $2, $3, $4) RETURNING id`,
    [userId, CONSENT_VERSION, listingId, userAgent?.slice(0, 200) ?? null],
  );
  await audit(`user:${userId}`, "consent.accepted", { userId, detail: { version: CONSENT_VERSION, listingId } });
  return row!.id;
}

/* ------------------------------------------------------------------ start */

export type StartResult =
  | { kind: "redirect"; url: string; verificationId: string }
  | { kind: "pending"; verificationId: string }
  | { kind: "reused"; verificationId: string };

export async function startVerification(input: {
  user: AppUser;
  listingId: string | null;
  idType: IdType;
  consentId: string;
  resumeId?: string | null;
}): Promise<StartResult> {
  const { user } = input;

  const reusable = await findReusable(user.id);
  if (reusable) {
    await audit(`user:${user.id}`, "verification.reused", { userId: user.id, verificationId: reusable.id, detail: { listingId: input.listingId } });
    return { kind: "reused", verificationId: reusable.id };
  }

  const mode = isMockMode() ? "mock" : "live";
  let verificationId = input.resumeId ?? null;
  if (verificationId) {
    const existing = await getVerification(verificationId);
    if (!existing || existing.user_id !== user.id || existing.outcome === "verified" || existing.outcome === "declined") verificationId = null;
  }
  if (!verificationId) {
    const row = await q1<{ id: string }>(
      `INSERT INTO kyc_verifications (user_id, consent_id, trigger_action, listing_id, id_type_chosen, mode, outcome)
       VALUES ($1,$2,'book_viewing',$3,$4,$5,'in_progress') RETURNING id`,
      [user.id, input.consentId, input.listingId, input.idType, mode],
    );
    verificationId = row!.id;
  } else {
    await q(`UPDATE kyc_verifications SET id_type_chosen = $2, consent_id = $3, outcome = 'in_progress', failure_reason = NULL, mode = $4, updated_at = now() WHERE id = $1`, [
      verificationId, input.idType, input.consentId, mode,
    ]);
  }

  const callback = `${env.appUrl()}/verify/result?v=${verificationId}`;
  try {
    if (await isOutageSimulated()) throw new DiditUnavailableError("simulated_outage", "Didit outage simulated from admin");

    if (mode === "mock") {
      const sessionId = `mock_${randomUUID()}`;
      await q(`UPDATE kyc_verifications SET didit_session_id = $2, didit_status = 'Not Started', updated_at = now() WHERE id = $1`, [verificationId, sessionId]);
      await audit(`user:${user.id}`, "verification.session_created", { userId: user.id, verificationId, detail: { mode, idType: input.idType } });
      return { kind: "redirect", url: `/mock-didit/${sessionId}`, verificationId };
    }

    const s = await createDiditSession({
      vendorData: user.id,
      callback,
      metadata: { verification_id: verificationId, listing_id: input.listingId, trigger: "book_viewing", id_type: input.idType },
    });
    // Didit returns the same unfinished session for the same vendor_data — keep the link idempotent.
    await q(
      `UPDATE kyc_verifications SET didit_session_id = $2, didit_session_number = $3, workflow_id = $4, didit_status = $5, updated_at = now() WHERE id = $1`,
      [verificationId, s.sessionId, s.sessionNumber, s.workflowId, s.status],
    );
    await audit(`user:${user.id}`, "verification.session_created", { userId: user.id, verificationId, detail: { mode, sessionNumber: s.sessionNumber, idType: input.idType } });
    return { kind: "redirect", url: s.url, verificationId };
  } catch (e) {
    if (e instanceof DiditUnavailableError) {
      // Rule 3 — never block the whole app. Save the request; only this step waits.
      await q(`UPDATE kyc_verifications SET outcome = 'pending', failure_reason = $2, updated_at = now() WHERE id = $1`, [verificationId, e.reason]);
      await audit("system", "verification.pending", { userId: user.id, verificationId, detail: { reason: e.reason } });
      return { kind: "pending", verificationId };
    }
    await q(`UPDATE kyc_verifications SET outcome = 'pending', failure_reason = 'config_error', updated_at = now() WHERE id = $1`, [verificationId]);
    await audit("system", "verification.config_error", { userId: user.id, verificationId, detail: { message: e instanceof Error ? e.message : String(e) } });
    return { kind: "pending", verificationId };
  }
}

/* ------------------------------------------------------------------ decisions */

type Mapped = { outcome: Outcome; reason: string | null };

/** Map Didit's session status to the five Grid outcomes (Walkthrough Guide §7). */
export function mapDecision(d: DiditDecision, idTypeChosen: string | null): Mapped {
  const idv = d.id_verifications?.[0];
  switch (d.status) {
    case "Approved":
      return { outcome: "verified", reason: null };
    case "In Review":
      return { outcome: "review", reason: "didit_in_review" };
    case "Resubmitted":
      return { outcome: "retry", reason: "resubmission_requested" };
    case "Abandoned":
    case "Expired":
      return { outcome: "retry", reason: "not_finished" };
    case "Kyc Expired":
      return { outcome: "retry", reason: "id_expired" };
    case "Declined": {
      // PhilSys Act (RA 11055): a PhilID holder must not be disadvantaged when the card can't be read.
      // If only the document step failed (liveness / face not declined), route to a person, never auto-decline.
      const docOnly =
        idv?.status === "Declined" &&
        !(d.liveness_checks ?? []).some((x) => x.status === "Declined") &&
        !(d.face_matches ?? []).some((x) => x.status === "Declined");
      if (idTypeChosen === "philid" && docOnly) return { outcome: "review", reason: "philid_scan_protected" };
      return { outcome: "declined", reason: "didit_declined" };
    }
    default:
      return { outcome: "in_progress", reason: null };
  }
}

function idFields(idv: DiditIdVerification | undefined) {
  if (!idv) return { name: null, dob: null, docType: null, expiry: null, state: null };
  const name = idv.full_name || [idv.first_name, idv.last_name].filter(Boolean).join(" ") || null;
  const date = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
  return { name, dob: date(idv.date_of_birth), docType: idv.document_type ?? null, expiry: date(idv.expiration_date), state: idv.issuing_state ?? null };
}

/**
 * Apply a Didit decision to our record. Idempotent. A staff decision always wins over later automated updates.
 * Stores results only — never images, document numbers or PhilSys numbers.
 */
export async function applyDecision(v: VerificationRow, d: DiditDecision, actor: string) {
  if (v.reviewed_by) return v; // manual decision is final
  const m = mapDecision(d, v.id_type_chosen);
  if (m.outcome === "in_progress" && v.outcome === "pending") return v;
  const f = idFields(d.id_verifications?.[0]);
  const final = m.outcome !== "in_progress";
  const updated = await q1<VerificationRow>(
    `UPDATE kyc_verifications SET
       didit_status = $2, outcome = $3, failure_reason = $4,
       verified_name = COALESCE($5, verified_name), date_of_birth = COALESCE($6::date, date_of_birth),
       document_type = COALESCE($7, document_type), document_expiry = COALESCE($8::date, document_expiry),
       issuing_state = COALESCE($9, issuing_state),
       didit_session_number = COALESCE($10, didit_session_number),
       decided_at = CASE WHEN $11 THEN now() ELSE decided_at END, updated_at = now()
     WHERE id = $1 RETURNING ${COLS}`,
    [v.id, d.status, m.outcome, m.reason, f.name, f.dob, f.docType, f.expiry, f.state, d.session_number ?? null, final],
  );
  if (v.outcome !== m.outcome || v.didit_status !== d.status) {
    await audit(actor, "verification.decision", {
      userId: v.user_id,
      verificationId: v.id,
      detail: { diditStatus: d.status, outcome: m.outcome, reason: m.reason },
    });
  }
  return updated ?? v;
}

/** Used by the result page so the flow also works locally, where Didit's webhook cannot reach us. */
export async function refreshFromDidit(v: VerificationRow) {
  if (v.mode !== "live" || !v.didit_session_id || v.outcome !== "in_progress") return v;
  try {
    return await applyDecision(v, await getDiditDecision(v.didit_session_id), "system:poll");
  } catch (e) {
    console.error("[kyc] refresh failed", e instanceof Error ? e.message : e);
    return v;
  }
}

/* ------------------------------------------------------------------ staff review */

export type ReviewAction = "approve" | "decline" | "request_retry";

export async function staffDecide(id: string, action: ReviewAction, note: string) {
  const v = await getVerification(id);
  if (!v) throw new Error("Verification not found");
  const outcome: Outcome = action === "approve" ? "verified" : action === "decline" ? "declined" : "retry";
  // A retry request is not a final decision, so it does not lock the record.
  const reviewer = action === "request_retry" ? null : "admin";
  await q(
    `UPDATE kyc_verifications SET outcome = $2, review_note = $3, reviewed_by = $4, reviewed_at = now(),
       failure_reason = CASE WHEN $2 = 'retry' THEN 'staff_requested_clearer_photo' ELSE failure_reason END,
       decided_at = CASE WHEN $2 IN ('verified','declined') THEN now() ELSE decided_at END, updated_at = now()
     WHERE id = $1`,
    [id, outcome, note.slice(0, 500), reviewer],
  );
  await audit("admin", `review.${action}`, { userId: v.user_id, verificationId: id, detail: { from: v.outcome, to: outcome } });
}

/* ------------------------------------------------------------------ bookings */

/** Open listings: any signed-in user can book. Verified-only listings: a passed, unexpired ID check is required. */
export async function bookViewing(userId: string, listingId: string, slot: string) {
  const listing = getListing(listingId);
  if (!listing) throw new Error("Unknown listing");
  const reusable = await findReusable(userId);
  if (listing.requiresKyc && !reusable) throw new Error("Identity not verified");
  await q(
    `INSERT INTO kyc_bookings (user_id, listing_id, slot, verification_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
    [userId, listingId, slot, listing.requiresKyc ? reusable!.id : null],
  );
  await audit(`user:${userId}`, "viewing.booked", {
    userId,
    verificationId: listing.requiresKyc ? reusable!.id : null,
    detail: { listingId, slot, access: listing.requiresKyc ? "verified_only" : "open" },
  });
}

export const userBookings = (userId: string) =>
  q<{ id: string; listing_id: string; slot: string; created_at: string }>(
    `SELECT id, listing_id, slot, created_at FROM kyc_bookings WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );

/* ------------------------------------------------------------------ mock Didit */

export const MOCK_SCENARIOS = {
  approve: "Clear ID and live selfie (Approved)",
  blurry: "Blurry ID photo (Resubmission requested)",
  review: "Unclear result (In Review)",
  philid_unreadable: "PhilID could not be read (Declined on ID only)",
  fraud: "Spoof attempt: photo of a screen (Declined)",
  abandon: "Closes the screen halfway (Abandoned)",
} as const;
export type MockScenario = keyof typeof MOCK_SCENARIOS;

/** Build a decision in Didit's v3 shape so the mock and live paths share applyDecision(). */
export function buildMockDecision(v: VerificationRow, scenario: MockScenario, userName: string): DiditDecision {
  const ok = { status: "Approved", warnings: [] };
  const expiry = new Date(Date.now() + 4 * 365 * 864e5).toISOString().slice(0, 10);
  const idv: DiditIdVerification = {
    status: "Approved",
    document_type: idTypeLabel(v.id_type_chosen),
    full_name: userName.toUpperCase(),
    date_of_birth: "1994-08-21",
    expiration_date: expiry,
    issuing_state: "PHL",
    warnings: [],
  };
  const base = { session_id: v.didit_session_id ?? undefined, vendor_data: v.user_id };
  switch (scenario) {
    case "approve":
      return { ...base, status: "Approved", id_verifications: [idv], liveness_checks: [ok], face_matches: [ok] };
    case "blurry":
      return { ...base, status: "Resubmitted", id_verifications: [{ ...idv, status: "Resub Requested", warnings: [{ risk: "LOW_QUALITY_IMAGE", short_description: "Document image is blurry" }] }] };
    case "review":
      return { ...base, status: "In Review", id_verifications: [{ ...idv, status: "In Review" }], liveness_checks: [ok], face_matches: [{ status: "In Review" }] };
    case "philid_unreadable":
      return { ...base, status: "Declined", id_verifications: [{ ...idv, status: "Declined", full_name: null, warnings: [{ risk: "DOCUMENT_NOT_READABLE", short_description: "Could not read document" }] }], liveness_checks: [ok], face_matches: [{ status: "Not Finished" }] };
    case "fraud":
      return { ...base, status: "Declined", id_verifications: [idv], liveness_checks: [{ status: "Declined", warnings: [{ risk: "POSSIBLE_SPOOF", short_description: "Screen replay detected" }] }], face_matches: [ok] };
    case "abandon":
      return { ...base, status: "Abandoned" };
  }
}

/* ------------------------------------------------------------------ admin stats */

export async function adminSnapshot() {
  const month = `date_trunc('month', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila'`;
  const [counts, completed, reused, review, pending, recent, events, log] = await Promise.all([
    q<{ outcome: Outcome; n: number }>(`SELECT outcome, count(*)::int AS n FROM kyc_verifications WHERE created_at >= ${month} GROUP BY outcome`),
    // Didit bills a feature when it completes: Approved, Declined or In Review (Readiness Report §3.2). Resubmitted attempts also completed.
    q1<{ n: number }>(`SELECT count(*)::int AS n FROM kyc_verifications WHERE mode = 'live' AND created_at >= ${month} AND didit_status IN ('Approved','Declined','In Review','Resubmitted')`),
    q1<{ n: number }>(`SELECT count(*)::int AS n FROM kyc_audit_log WHERE action = 'verification.reused' AND at >= ${month}`),
    q<VerificationRow>(`SELECT ${COLS} FROM kyc_verifications WHERE outcome = 'review' ORDER BY updated_at ASC LIMIT 50`),
    q<VerificationRow>(`SELECT ${COLS} FROM kyc_verifications WHERE outcome = 'pending' ORDER BY updated_at ASC LIMIT 50`),
    q<VerificationRow>(`SELECT ${COLS} FROM kyc_verifications ORDER BY updated_at DESC LIMIT 25`),
    q<{ event_id: string; webhook_type: string | null; status: string | null; signature_method: string | null; processed: boolean; received_at: string }>(
      `SELECT event_id, webhook_type, status, signature_method, processed, received_at FROM kyc_webhook_events ORDER BY received_at DESC LIMIT 15`,
    ),
    q<{ id: number; at: string; actor: string; action: string; user_id: string | null; detail: Record<string, unknown> }>(
      `SELECT id, at, actor, action, user_id, detail FROM kyc_audit_log ORDER BY at DESC LIMIT 40`,
    ),
  ]);
  const mockCompleted = await q1<{ n: number }>(
    `SELECT count(*)::int AS n FROM kyc_verifications WHERE mode = 'mock' AND created_at >= ${month} AND didit_status IN ('Approved','Declined','In Review','Resubmitted')`,
  );
  const byOutcome = Object.fromEntries(counts.map((c) => [c.outcome, c.n])) as Partial<Record<Outcome, number>>;
  return {
    byOutcome,
    completedLive: completed?.n ?? 0,
    completedMock: mockCompleted?.n ?? 0,
    reused: reused?.n ?? 0,
    review,
    pending,
    recent,
    events,
    log,
    outage: await isOutageSimulated(),
  };
}

/** Delete accounts created through Register (demo accounts are kept). */
export async function deleteRegisteredAccounts() {
  const rows = await q<{ n: number }>(`WITH d AS (DELETE FROM kyc_users WHERE id LIKE 'usr_%' RETURNING 1) SELECT count(*)::int AS n FROM d`);
  await audit("admin", "demo.accounts_deleted", { detail: { count: rows[0]?.n ?? 0 } });
}

export async function resetDemoData() {
  await q(`DELETE FROM kyc_documents`);
  await q(`DELETE FROM kyc_bookings`);
  await q(`DELETE FROM kyc_verifications`);
  await q(`DELETE FROM kyc_consents`);
  await q(`DELETE FROM kyc_webhook_events`);
  await setSetting("simulate_outage", false);
  const { seedReturningTenant } = await import("./db");
  await seedReturningTenant();
  await audit("admin", "demo.reset");
}
