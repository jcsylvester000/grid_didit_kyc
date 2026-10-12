import "server-only";
import { q } from "./db";

/**
 * Append-only audit trail. `detail` must never contain personal data
 * (no names, birth dates, ID numbers, images) — only statuses, codes and IDs.
 */
export async function audit(
  actor: string,
  action: string,
  opts: { userId?: string | null; verificationId?: string | null; detail?: Record<string, unknown> } = {},
) {
  try {
    await q(
      `INSERT INTO kyc_audit_log (actor, action, user_id, verification_id, detail) VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [actor, action, opts.userId ?? null, opts.verificationId ?? null, JSON.stringify(opts.detail ?? {})],
    );
  } catch (e) {
    console.error("[audit] failed to write", action, e instanceof Error ? e.message : e);
  }
}
