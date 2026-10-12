import "server-only";
import { q } from "./db";
import type { VerificationRow } from "@/lib/types";
import type { DocRow } from "./documents";

/** Staff console tables are paginated: 30 rows per page, newest first. */
export const PAGE_SIZE = 30;
export type Paged<T> = { rows: T[]; total: number; page: number; pages: number; from: number; to: number };

async function paged<T>(countSql: string, rowsSql: string, rawPage: number): Promise<Paged<T>> {
  const total = (await q<{ n: number }>(countSql))[0]?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(rawPage) || 1), pages);
  const offset = (page - 1) * PAGE_SIZE;
  const rows = await q<T>(`${rowsSql} LIMIT ${PAGE_SIZE} OFFSET $1`, [offset]);
  return { rows, total, page, pages, from: total ? offset + 1 : 0, to: offset + rows.length };
}

export type AuditRow = { id: number; at: string; actor: string; actor_name: string | null; action: string; detail: Record<string, unknown> };
export const auditPage = (page: number) =>
  paged<AuditRow>(
    `SELECT count(*)::int AS n FROM kyc_audit_log`,
    `SELECT a.id, a.at, a.actor, u.display_name AS actor_name, a.action, a.detail
     FROM kyc_audit_log a LEFT JOIN kyc_users u ON a.actor LIKE 'user:%' AND u.id = substr(a.actor, 6)
     ORDER BY a.at DESC, a.id DESC`,
    page,
  );

export type UserRow = { id: string; name: string; email: string; role: string; created_at: string; last_login_at: string | null; kyc_outcome: string | null; bookings: number; documents: number };
export const usersPage = (page: number) =>
  paged<UserRow>(
    `SELECT count(*)::int AS n FROM kyc_users`,
    `SELECT u.id, u.display_name AS name, u.email, u.role, u.created_at, u.last_login_at,
            (SELECT v.outcome FROM kyc_verifications v WHERE v.user_id = u.id ORDER BY v.created_at DESC LIMIT 1) AS kyc_outcome,
            (SELECT count(*)::int FROM kyc_bookings b WHERE b.user_id = u.id) AS bookings,
            (SELECT count(*)::int FROM kyc_documents d WHERE d.owner_id = u.id OR d.broker_id = u.id) AS documents
     FROM kyc_users u ORDER BY u.created_at DESC, u.id`,
    page,
  );

export const documentsPage = (page: number) =>
  paged<DocRow>(
    `SELECT count(*)::int AS n FROM kyc_documents`,
    `SELECT d.id, d.status, d.listing_id, d.terms, d.title_check, d.updated_at, d.completed_at, b.display_name AS broker_name, o.display_name AS owner_name
     FROM kyc_documents d JOIN kyc_users b ON b.id = d.broker_id JOIN kyc_users o ON o.id = d.owner_id
     ORDER BY d.updated_at DESC, d.id`,
    page,
  );

export type VerificationAdminRow = VerificationRow & { user_name: string | null };
export const verificationsPage = (page: number) =>
  paged<VerificationAdminRow>(
    `SELECT count(*)::int AS n FROM kyc_verifications`,
    `SELECT v.id, v.user_id, u.display_name AS user_name, v.outcome, v.didit_status, v.id_type_chosen, v.mode, v.reviewed_by, v.review_note,
            v.didit_session_number, v.updated_at, v.created_at
     FROM kyc_verifications v LEFT JOIN kyc_users u ON u.id = v.user_id
     ORDER BY v.updated_at DESC, v.id`,
    page,
  );

export type WebhookRow = { event_id: string; session_id: string | null; webhook_type: string | null; status: string | null; signature_method: string | null; processed: boolean; received_at: string };
export const webhooksPage = (page: number) =>
  paged<WebhookRow>(
    `SELECT count(*)::int AS n FROM kyc_webhook_events`,
    `SELECT event_id, session_id, webhook_type, status, signature_method, processed, received_at FROM kyc_webhook_events ORDER BY received_at DESC, event_id`,
    page,
  );
