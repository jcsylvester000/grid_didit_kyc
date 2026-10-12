import "server-only";
import { q1 } from "./db";
import type { Outcome } from "@/lib/types";

export type Journey = {
  createdAt: string;
  kyc: Outcome | null; // latest check outcome, null = never started
  verified: boolean; // passed and ID not expired
  bookings: number;
};

/** The three milestones the internal team should see: account → identity check → first viewing. */
export async function journeyFor(userId: string): Promise<Journey | null> {
  const row = await q1<{ created_at: string; kyc: Outcome | null; verified: boolean; bookings: number }>(
    `SELECT u.created_at,
            (SELECT v.outcome FROM kyc_verifications v WHERE v.user_id = u.id ORDER BY v.created_at DESC LIMIT 1) AS kyc,
            EXISTS (SELECT 1 FROM kyc_verifications v WHERE v.user_id = u.id AND v.outcome = 'verified'
                    AND (v.document_expiry IS NULL OR v.document_expiry >= current_date)) AS verified,
            (SELECT count(*)::int FROM kyc_bookings b WHERE b.user_id = u.id) AS bookings
     FROM kyc_users u WHERE u.id = $1`,
    [userId],
  );
  return row ? { createdAt: row.created_at, kyc: row.kyc, verified: row.verified, bookings: row.bookings } : null;
}
