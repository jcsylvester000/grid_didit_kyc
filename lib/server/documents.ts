import "server-only";
import { createHash } from "node:crypto";
import { q, q1 } from "./db";
import { env, isMockMode } from "./env";
import { audit } from "./audit";
import { findReusable } from "./kyc";
import { createBiometricSession, getDiditDecision, runDocumentAi, DiditUnavailableError, type DiditDecision } from "./didit";
import type { AppUser } from "./auth";
import { ATS_TEMPLATE_VERSION, BROKER_PRC, getListing, idTypeLabel } from "@/lib/data";

/*
  Document transactions — who does what:
    Didit  → identity of each signer (KYC), 5-second face re-check at signing (Biometric Authentication),
             title-copy reading + name match + tamper checks (Document AI).
    Grid   → the document itself, routing and status, consent to e-sign, drawn signature, SHA-256 seal, audit trail.
    Neither→ notarization (licensed / electronic notary) and title authenticity (Registry of Deeds CTC).
*/

export type DocStatus = "draft" | "awaiting_owner" | "awaiting_broker" | "completed" | "cancelled";
export type AtsTerms = { salePricePhp: number; commissionPct: number; exclusive: boolean; termMonths: number; startDate: string; endDate: string };
export type PartySnapshot = { userId: string; accountName: string; verifiedName: string | null; idType: string | null; verifiedAt: string | null; prc?: string | null };
export type TitleCheck = {
  mode: "live" | "simulated";
  status: "Approved" | "Declined" | "In Review";
  titleNumber: string | null;
  ownerOnTitle: string | null;
  location: string | null;
  matchScore: number | null;
  warnings: string[];
  requestId: string | null;
  checkedAt: string;
};
export type DocRow = {
  id: string;
  doc_type: string;
  template_version: string;
  status: DocStatus;
  listing_id: string;
  broker_id: string;
  owner_id: string;
  terms: AtsTerms;
  parties: { owner?: PartySnapshot; broker?: PartySnapshot };
  title_check: TitleCheck | null;
  content_hash: string | null;
  final_hash: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  completed_at: string | null;
  broker_name?: string;
  owner_name?: string;
};
export type FaceCheck = { id: string; user_id: string; document_id: string; mode: "live" | "simulated"; didit_session_id: string | null; didit_session_number: number | null; status: "pending" | "approved" | "declined"; created_at: string; decided_at: string | null };
export type Signature = { id: string; user_id: string; role: "owner" | "broker"; signature_svg: string; face_check_id: string | null; signed_hash: string; consent_text: string; signed_at: string; signer_name: string; face_mode: string | null; face_session_number: number | null };

export const ESIGN_CONSENT =
  "I agree to sign this document electronically. My drawn signature, together with my verified identity and today's face check, has the same effect as my handwritten signature.";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
function canonical(v: unknown): string {
  const sort = (x: unknown): unknown =>
    Array.isArray(x) ? x.map(sort) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, sort((x as Record<string, unknown>)[k])])) : x;
  return JSON.stringify(sort(v));
}

const DOC_COLS = `d.id, d.doc_type, d.template_version, d.status, d.listing_id, d.broker_id, d.owner_id, d.terms, d.parties, d.title_check,
  d.content_hash, d.final_hash, d.created_at, d.updated_at, d.sent_at, d.completed_at, b.display_name AS broker_name, o.display_name AS owner_name`;
const DOC_FROM = `FROM kyc_documents d JOIN kyc_users b ON b.id = d.broker_id JOIN kyc_users o ON o.id = d.owner_id`;

export const getDocument = (id: string) =>
  /^[0-9a-f-]{36}$/i.test(id) ? q1<DocRow>(`SELECT ${DOC_COLS} ${DOC_FROM} WHERE d.id = $1`, [id]) : Promise.resolve(null);
export const documentsForUser = (userId: string) =>
  q<DocRow>(`SELECT ${DOC_COLS} ${DOC_FROM} WHERE d.broker_id = $1 OR d.owner_id = $1 ORDER BY d.updated_at DESC LIMIT 50`, [userId]);
export const allDocuments = () => q<DocRow>(`SELECT ${DOC_COLS} ${DOC_FROM} ORDER BY d.updated_at DESC LIMIT 25`);
export const completedAtsForListing = (listingId: string) =>
  q1<DocRow>(`SELECT ${DOC_COLS} ${DOC_FROM} WHERE d.listing_id = $1 AND d.status = 'completed' ORDER BY d.completed_at DESC LIMIT 1`, [listingId]);
export const documentEvents = (id: string) =>
  q<{ id: number; at: string; actor_id: string | null; actor_name: string | null; action: string; detail: Record<string, unknown> }>(
    `SELECT e.id, e.at, e.actor_id, u.display_name AS actor_name, e.action, e.detail FROM kyc_document_events e LEFT JOIN kyc_users u ON u.id = e.actor_id WHERE e.document_id = $1 ORDER BY e.at, e.id`,
    [id],
  );
export const documentSignatures = (id: string) =>
  q<Signature>(
    `SELECT s.id, s.user_id, s.role, s.signature_svg, s.face_check_id, s.signed_hash, s.consent_text, s.signed_at, u.display_name AS signer_name,
            f.mode AS face_mode, f.didit_session_number AS face_session_number
     FROM kyc_document_signatures s JOIN kyc_users u ON u.id = s.user_id LEFT JOIN kyc_face_checks f ON f.id = s.face_check_id
     WHERE s.document_id = $1 ORDER BY s.signed_at`,
    [id],
  );
export const getFaceCheck = (id: string) =>
  /^[0-9a-f-]{36}$/i.test(id) ? q1<FaceCheck>(`SELECT * FROM kyc_face_checks WHERE id = $1`, [id]) : Promise.resolve(null);
export const getFaceCheckBySession = (sessionId: string) => q1<FaceCheck>(`SELECT * FROM kyc_face_checks WHERE didit_session_id = $1`, [sessionId]);

async function docEvent(documentId: string, actorId: string | null, action: string, detail: Record<string, unknown> = {}) {
  await q(`INSERT INTO kyc_document_events (document_id, actor_id, action, detail) VALUES ($1,$2,$3,$4::jsonb)`, [documentId, actorId, action, JSON.stringify(detail)]);
  await audit(actorId ? `user:${actorId}` : "system", `document.${action}`, { userId: actorId, detail: { documentId, ...pickSafe(detail) } });
}
// Audit log gets codes only (no names/addresses); the per-document trail keeps the business detail.
const pickSafe = (d: Record<string, unknown>) => Object.fromEntries(Object.entries(d).filter(([k]) => ["status", "role", "mode", "hash"].includes(k)));

export const roleIn = (doc: DocRow, userId: string): "broker" | "owner" | null => (doc.broker_id === userId ? "broker" : doc.owner_id === userId ? "owner" : null);

/** What goes into the seal: the agreement itself (not the signatures). Any change after sending breaks the hash. */
export function documentContent(doc: Pick<DocRow, "id" | "template_version" | "listing_id" | "terms" | "parties">) {
  const l = getListing(doc.listing_id);
  return {
    documentId: doc.id,
    template: doc.template_version,
    property: l ? { id: l.id, title: l.title, address: l.exactAddress, type: l.type, floorAreaSqm: l.sqm } : { id: doc.listing_id },
    owner: doc.parties.owner ? { name: doc.parties.owner.verifiedName ?? doc.parties.owner.accountName, idType: doc.parties.owner.idType } : null,
    broker: doc.parties.broker ? { name: doc.parties.broker.verifiedName ?? doc.parties.broker.accountName, prc: doc.parties.broker.prc ?? null } : null,
    terms: doc.terms,
  };
}
export const contentHash = (doc: Pick<DocRow, "id" | "template_version" | "listing_id" | "terms" | "parties">) => sha256(canonical(documentContent(doc)));

async function snapshot(user: { id: string; name: string }): Promise<PartySnapshot> {
  const v = await findReusable(user.id);
  return { userId: user.id, accountName: user.name, verifiedName: v?.verified_name ?? null, idType: v ? (v.document_type ?? idTypeLabel(v.id_type_chosen)) : null, verifiedAt: v?.decided_at ?? null, prc: BROKER_PRC[user.id] ?? null };
}

/* ---------------------------------------------------------------- create / send */

export async function createAts(broker: AppUser, input: { listingId: string; ownerEmail: string; terms: AtsTerms }) {
  if (broker.role !== "broker") throw new Error("Only brokers can draft an Authority to Sell.");
  if (!(await findReusable(broker.id))) throw new Error("Verify your identity before drafting documents.");
  if (!getListing(input.listingId)) throw new Error("Unknown property.");
  const owner = await q1<{ id: string; name: string }>(`SELECT id, display_name AS name FROM kyc_users WHERE lower(email) = $1`, [input.ownerEmail.trim().toLowerCase()]);
  if (!owner) throw new Error("No Grid account uses that owner email. Ask the owner to register first.");
  if (owner.id === broker.id) throw new Error("The owner and the broker must be different people.");
  const parties = { broker: await snapshot(broker), owner: await snapshot(owner) };
  const row = await q1<{ id: string }>(
    `INSERT INTO kyc_documents (doc_type, template_version, status, listing_id, broker_id, owner_id, terms, parties)
     VALUES ('ats', $1, 'draft', $2, $3, $4, $5::jsonb, $6::jsonb) RETURNING id`,
    [ATS_TEMPLATE_VERSION, input.listingId, broker.id, owner.id, JSON.stringify(input.terms), JSON.stringify(parties)],
  );
  await docEvent(row!.id, broker.id, "created", { status: "draft" });
  return row!.id;
}

export async function sendToOwner(doc: DocRow, broker: AppUser) {
  if (doc.broker_id !== broker.id || doc.status !== "draft") throw new Error("Only the broker can send a draft.");
  // Refresh identities at the moment of sending, then lock the content with a SHA-256 hash.
  const parties = { broker: await snapshot({ id: broker.id, name: broker.name }), owner: await snapshot({ id: doc.owner_id, name: doc.owner_name ?? "" }) };
  const hash = contentHash({ ...doc, parties });
  await q(`UPDATE kyc_documents SET parties = $2::jsonb, content_hash = $3, status = 'awaiting_owner', sent_at = now(), updated_at = now() WHERE id = $1`, [doc.id, JSON.stringify(parties), hash]);
  await docEvent(doc.id, broker.id, "sent", { status: "awaiting_owner", hash });
}

export async function cancelDocument(doc: DocRow, user: AppUser) {
  if (doc.broker_id !== user.id || doc.status === "completed") throw new Error("This document can't be cancelled.");
  await q(`UPDATE kyc_documents SET status = 'cancelled', updated_at = now() WHERE id = $1`, [doc.id]);
  await docEvent(doc.id, user.id, "cancelled", { status: "cancelled" });
}

/* ---------------------------------------------------------------- title copy (Didit Document AI) */

export const TITLE_SCENARIOS = {
  clean: "Clean title copy, owner's name matches",
  mismatch: "Title copy in someone else's name",
  edited: "File shows signs of editing",
} as const;
export type TitleScenario = keyof typeof TITLE_SCENARIOS;

const TITLE_FIELDS = [
  { key: "registered_owner", name: "Registered owner", instruction: "Full name of the registered owner on the title", type: "text" as const, required: true, is_full_name: true },
  { key: "title_number", name: "Title number", instruction: "TCT or CCT number, e.g. 007-2019001234", type: "text" as const, required: true },
  { key: "location", name: "Location", instruction: "City or municipality of the property", type: "text" as const, required: false },
];

/** The file goes straight to Didit and is not stored by Grid. Grid keeps only the result. */
export async function checkTitleCopy(doc: DocRow, owner: AppUser, input: { file: File | null; scenario: TitleScenario }) {
  if (doc.owner_id !== owner.id || doc.status !== "awaiting_owner") throw new Error("Only the owner can add the title copy at this stage.");
  const ownerName = doc.parties.owner?.verifiedName ?? owner.name;
  const live = !isMockMode() && input.file && input.file.size > 0;
  let check: TitleCheck;
  if (live) {
    const parts = ownerName.trim().split(/\s+/);
    try {
      const r = await runDocumentAi({ file: input.file!, fields: TITLE_FIELDS, expectedFirstName: parts.slice(0, -1).join(" ") || parts[0], expectedLastName: parts.at(-1) ?? "", vendorData: owner.id });
      check = {
        mode: "live",
        status: r.status,
        titleNumber: (r.extracted.title_number as string) ?? null,
        ownerOnTitle: r.nameOnDocument ?? ((r.extracted.registered_owner as string) || null),
        location: (r.extracted.location as string) ?? null,
        matchScore: r.nameMatchScore,
        warnings: r.warnings.map((w) => w.short_description ?? w.risk ?? "Warning"),
        requestId: r.requestId,
        checkedAt: new Date().toISOString(),
      };
    } catch (e) {
      if (e instanceof DiditUnavailableError) throw new Error("Didit's document check is busy right now. Please try again in a moment.");
      throw e;
    }
  } else {
    const l = getListing(doc.listing_id);
    const base = { mode: "simulated" as const, titleNumber: "CCT No. 007-2019001234 (sample)", location: l?.area.split(",").at(-1)?.trim() ?? null, requestId: null, checkedAt: new Date().toISOString() };
    check =
      input.scenario === "mismatch"
        ? { ...base, status: "Declined", ownerOnTitle: "ERNESTO VILLANUEVA", matchScore: 21, warnings: ["Name on document does not match the verified owner"] }
        : input.scenario === "edited"
          ? { ...base, status: "In Review", ownerOnTitle: ownerName.toUpperCase(), matchScore: 97, warnings: ["PDF was modified after creation (possible editing)"] }
          : { ...base, status: "Approved", ownerOnTitle: ownerName.toUpperCase(), matchScore: 96, warnings: [] };
  }
  await q(`UPDATE kyc_documents SET title_check = $2::jsonb, updated_at = now() WHERE id = $1`, [doc.id, JSON.stringify(check)]);
  await docEvent(doc.id, owner.id, "title_checked", { status: check.status, mode: check.mode, matchScore: check.matchScore, warnings: check.warnings.length });
  return check;
}

/* ---------------------------------------------------------------- face re-check (Didit Biometric Authentication) */

/** Live only when Didit holds this person's face (they passed a real Didit check) and the workflow is configured. */
export async function faceCheckMode(userId: string): Promise<{ mode: "live" | "simulated"; reason: string | null }> {
  if (isMockMode()) return { mode: "simulated", reason: "Mock mode: no Didit API key is set." };
  if (!env.diditBiometricWorkflowId()) return { mode: "simulated", reason: "DIDIT_BIOMETRIC_WORKFLOW_ID is not set." };
  const v = await findReusable(userId);
  if (v?.mode !== "live") return { mode: "simulated", reason: "This account was verified with sample data, so Didit has no face on file to compare." };
  return { mode: "live", reason: null };
}

export async function startFaceCheck(doc: DocRow, user: AppUser): Promise<string> {
  const role = roleIn(doc, user.id);
  if (!role || (role === "owner" && doc.status !== "awaiting_owner") || (role === "broker" && doc.status !== "awaiting_broker")) throw new Error("It's not your turn to sign.");
  const { mode } = await faceCheckMode(user.id);
  const fc = await q1<{ id: string }>(`INSERT INTO kyc_face_checks (user_id, document_id, mode, status) VALUES ($1,$2,$3,'pending') RETURNING id`, [user.id, doc.id, mode]);
  const id = fc!.id;
  await docEvent(doc.id, user.id, "face_check_started", { role, mode });
  if (mode === "simulated") return `/documents/${doc.id}/face-check/${id}`;
  try {
    const s = await createBiometricSession({ vendorData: user.id, callback: `${env.appUrl()}/documents/${doc.id}/sign?fc=${id}`, metadata: { document_id: doc.id, face_check_id: id, role } });
    await q(`UPDATE kyc_face_checks SET didit_session_id = $2, didit_session_number = $3 WHERE id = $1`, [id, s.sessionId, s.sessionNumber]);
    return s.url;
  } catch (e) {
    await q(`UPDATE kyc_face_checks SET status = 'declined', decided_at = now() WHERE id = $1`, [id]);
    await docEvent(doc.id, user.id, "face_check_error", { mode, message: e instanceof Error ? e.message.slice(0, 120) : "error" });
    throw new Error("The face check couldn't start right now. Please try again.");
  }
}

function faceOutcome(d: DiditDecision): FaceCheck["status"] {
  if (d.status === "Approved") {
    const ok = (arr?: { status?: string }[] | null) => !arr || arr.length === 0 || arr.every((x) => x.status === "Approved");
    return ok(d.liveness_checks) && ok(d.face_matches) ? "approved" : "declined";
  }
  if (["Declined", "Abandoned", "Expired"].includes(d.status)) return "declined";
  return "pending";
}

export async function applyFaceDecision(fc: FaceCheck, d: DiditDecision, actor: string) {
  if (fc.status !== "pending") return fc;
  const status = faceOutcome(d);
  if (status === "pending") return fc;
  await q(`UPDATE kyc_face_checks SET status = $2, decided_at = now(), didit_session_number = COALESCE($3, didit_session_number) WHERE id = $1`, [fc.id, status, d.session_number ?? null]);
  await docEvent(fc.document_id, fc.user_id, status === "approved" ? "face_check_passed" : "face_check_failed", { mode: fc.mode, via: actor });
  return { ...fc, status };
}

/** Result page polls Didit so the flow also works locally without the webhook. */
export async function refreshFaceCheck(fc: FaceCheck) {
  if (fc.mode !== "live" || fc.status !== "pending" || !fc.didit_session_id) return fc;
  try {
    return await applyFaceDecision(fc, await getDiditDecision(fc.didit_session_id), "poll");
  } catch {
    return fc;
  }
}

export async function completeSimulatedFaceCheck(fc: FaceCheck, user: AppUser, pass: boolean) {
  if (fc.user_id !== user.id || fc.mode !== "simulated" || fc.status !== "pending") throw new Error("Face check not available.");
  return applyFaceDecision(fc, { status: pass ? "Approved" : "Declined", liveness_checks: [{ status: pass ? "Approved" : "Declined" }], face_matches: [{ status: pass ? "Approved" : "Declined" }] }, "simulated");
}

/* ---------------------------------------------------------------- sign + seal */

const FACE_CHECK_VALID_MINUTES = 15;

export async function signDocument(doc: DocRow, user: AppUser, input: { faceCheckId: string; signatureSvg: string; consent: boolean; userAgent: string | null }) {
  const role = roleIn(doc, user.id);
  if (!role) throw new Error("You're not a party to this document.");
  if ((role === "owner" && doc.status !== "awaiting_owner") || (role === "broker" && doc.status !== "awaiting_broker")) throw new Error("It's not your turn to sign.");
  if (!(await findReusable(user.id))) throw new Error("Verify your identity before signing.");
  if (!input.consent) throw new Error("Please agree to sign electronically.");
  if (!/^M[\d.\s,MLQCZ-]+$/i.test(input.signatureSvg) || input.signatureSvg.length < 40 || input.signatureSvg.length > 60_000) throw new Error("Please draw your signature in the box.");
  if (role === "owner" && (!doc.title_check || doc.title_check.status === "Declined")) throw new Error("A title copy that matches your name is needed before you sign.");

  const fc = await getFaceCheck(input.faceCheckId);
  const fresh = fc?.decided_at && Date.now() - new Date(fc.decided_at).getTime() < FACE_CHECK_VALID_MINUTES * 60_000;
  if (!fc || fc.user_id !== user.id || fc.document_id !== doc.id || fc.status !== "approved" || !fresh) throw new Error("Please complete the face check again before signing.");
  const used = await q1(`SELECT 1 FROM kyc_document_signatures WHERE face_check_id = $1`, [fc.id]);
  if (used) throw new Error("This face check was already used. Please do a new one.");

  // Integrity: the agreement must be byte-for-byte what was sent.
  const now = contentHash(doc);
  if (!doc.content_hash || now !== doc.content_hash) {
    await docEvent(doc.id, user.id, "integrity_failed", { status: doc.status });
    throw new Error("This document changed after it was sent, so it can't be signed. Ask the broker to send a new copy.");
  }

  await q(
    `INSERT INTO kyc_document_signatures (document_id, user_id, role, signature_svg, face_check_id, signed_hash, consent_text, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [doc.id, user.id, role, input.signatureSvg, fc.id, doc.content_hash, ESIGN_CONSENT, input.userAgent?.slice(0, 200) ?? null],
  );
  await docEvent(doc.id, user.id, "signed", { role, hash: doc.content_hash, faceCheck: fc.mode });

  if (role === "owner") {
    await q(`UPDATE kyc_documents SET status = 'awaiting_broker', updated_at = now() WHERE id = $1`, [doc.id]);
    return "awaiting_broker" as const;
  }
  const sigs = await documentSignatures(doc.id);
  const finalHash = sha256(canonical({ content: doc.content_hash, titleCheck: doc.title_check, signatures: sigs.map((s) => ({ role: s.role, user: s.user_id, at: s.signed_at, sig: sha256(s.signature_svg), face: s.face_check_id })) }));
  await q(`UPDATE kyc_documents SET status = 'completed', final_hash = $2, completed_at = now(), updated_at = now() WHERE id = $1`, [doc.id, finalHash]);
  await docEvent(doc.id, user.id, "completed", { status: "completed", hash: finalHash });
  return "completed" as const;
}
