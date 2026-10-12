import { NextResponse } from "next/server";
import { q, q1 } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { audit } from "@/lib/server/audit";
import { verifyDiditWebhook } from "@/lib/server/webhook-signature";
import { getDiditDecision, type DiditDecision } from "@/lib/server/didit";
import { applyDecision, getVerificationBySession } from "@/lib/server/kyc";
import { applyFaceDecision, getFaceCheckBySession } from "@/lib/server/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = DiditDecision & {
  event_id?: string;
  webhook_type?: string;
  session_id?: string;
  timestamp?: number;
  decision?: DiditDecision | null;
};

/**
 * Didit -> Grid result notification.
 * 1. Verify signature on the RAW body (never re-stringify).  2. Dedupe on event_id (append-only log).
 * 3. Apply the decision idempotently.  4. Reply 2xx fast (Didit waits 5 s, retries twice).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = verifyDiditWebhook(raw, req.headers, env.diditWebhookSecret());
  if (!sig.ok) {
    await audit("didit:webhook", "webhook.rejected", { detail: { reason: sig.reason } });
    return NextResponse.json({ ok: false, error: sig.reason }, { status: 401 });
  }

  const p = JSON.parse(raw) as Payload;
  const sessionId = p.session_id ?? p.decision?.session_id;
  const eventId = p.event_id ?? `${sessionId}:${p.status}:${req.headers.get("x-timestamp")}`;

  const inserted = await q1<{ event_id: string }>(
    `INSERT INTO kyc_webhook_events (event_id, session_id, webhook_type, status, signature_method)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
    [eventId, sessionId ?? null, p.webhook_type ?? null, p.status ?? null, sig.method],
  );
  if (!inserted) return NextResponse.json({ ok: true, duplicate: true });

  if (!sessionId) return NextResponse.json({ ok: true, ignored: "no session_id" });
  const v = await getVerificationBySession(sessionId);
  if (!v) {
    // Biometric re-check at document signing (separate Didit workflow).
    const fc = await getFaceCheckBySession(sessionId);
    if (fc) {
      let fd: DiditDecision | null = p.decision ? { ...p.decision, status: p.status ?? p.decision.status } : null;
      if (!fd && p.status) {
        try { fd = await getDiditDecision(sessionId); } catch { fd = { status: p.status }; }
      }
      if (fd) await applyFaceDecision(fc, fd, "webhook");
      await q(`UPDATE kyc_webhook_events SET processed = true WHERE event_id = $1`, [eventId]);
      return NextResponse.json({ ok: true, kind: "face_check" });
    }
    await audit("didit:webhook", "webhook.unknown_session", { detail: { eventId, status: p.status } });
    return NextResponse.json({ ok: true, ignored: "unknown session" });
  }

  // Prefer the signed payload's decision; fall back to fetching it from Didit.
  let decision: DiditDecision | null = p.decision ? { ...p.decision, status: p.status ?? p.decision.status } : null;
  if (!decision && p.status && !["Approved", "Declined", "In Review"].includes(p.status)) decision = { status: p.status };
  if (!decision) {
    try {
      decision = await getDiditDecision(sessionId);
    } catch {
      decision = p.status ? { status: p.status } : null;
    }
  }
  if (decision) await applyDecision(v, decision, "didit:webhook");
  await q(`UPDATE kyc_webhook_events SET processed = true WHERE event_id = $1`, [eventId]);
  return NextResponse.json({ ok: true });
}
