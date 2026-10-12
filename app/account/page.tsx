import Link from "next/link";
import type { Metadata } from "next";
import { getListing, idTypeLabel } from "@/lib/data";
import { currentUser } from "@/lib/server/session";
import { dbConfigured, q } from "@/lib/server/db";
import { findReusable, userBookings, userVerifications } from "@/lib/server/kyc";
import { DbMissing, Notice, OutcomeChip, VerifiedBadge } from "@/components/ui";
import { requestErasureAction } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My verification" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }) : "—");

export default async function AccountPage({ searchParams }: Props) {
  if (!dbConfigured()) return <DbMissing />;
  const sp = await searchParams;
  const user = await currentUser();
  const [verified, history, bookings, consents] = await Promise.all([
    findReusable(user.id),
    userVerifications(user.id),
    userBookings(user.id),
    q<{ id: string; wording_version: string; accepted_at: string; listing_id: string | null }>(
      `SELECT id, wording_version, accepted_at, listing_id FROM kyc_consents WHERE user_id = $1 ORDER BY accepted_at DESC LIMIT 10`,
      [user.id],
    ),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="eyebrow">My verification</p>
        <h1 className="text-3xl text-nile">{user.name}</h1>
      </div>
      {sp.erasure && <Notice tone="ok">Deletion request sent to our Data Protection Officer. We&apos;ll erase your data from Grid and Didit and confirm by email.</Notice>}

      <section className="card p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <h2 className="text-xl text-nile">Identity status</h2>
          {verified ? <VerifiedBadge /> : history[0] ? <OutcomeChip outcome={history[0].outcome} /> : <span className="text-sm text-muted">Not verified</span>}
        </div>
        {verified ? (
          <>
            <p className="text-sm text-muted">This is everything Grid keeps from your check. Your ID photo and selfie stay with Didit and are deleted after the retention period.</p>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-muted">Verified name</dt><dd className="font-medium">{verified.verified_name ?? "—"}</dd></div>
              <div><dt className="text-muted">Date of birth</dt><dd className="font-medium">{verified.date_of_birth ?? "—"}</dd></div>
              <div><dt className="text-muted">ID type</dt><dd className="font-medium">{verified.document_type ?? idTypeLabel(verified.id_type_chosen)}</dd></div>
              <div><dt className="text-muted">ID valid until</dt><dd className="font-medium">{verified.document_expiry ?? "—"}</dd></div>
              <div><dt className="text-muted">Verified on</dt><dd className="font-medium">{fmt(verified.decided_at)}</dd></div>
              <div><dt className="text-muted">Didit session</dt><dd className="font-medium">{verified.didit_session_number ? `#${verified.didit_session_number}` : verified.mode === "seed" ? "Sample record" : "—"}</dd></div>
            </dl>
          </>
        ) : history[0] && ["review", "pending", "in_progress", "retry"].includes(history[0].outcome) ? (
          <Link href={`/verify/result?v=${history[0].id}`} className="btn btn-ghost">See status</Link>
        ) : (
          <p className="text-sm text-muted">You&apos;ll be asked to verify only when you book your first viewing.</p>
        )}
      </section>

      <section className="card p-6 space-y-3">
        <h2 className="text-xl text-nile">Viewings</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted">No viewings booked yet.</p>
        ) : (
          <ul className="text-sm divide-y divide-line">
            {bookings.map((b) => (
              <li key={b.id} className="py-2 flex justify-between gap-4">
                <span>{getListing(b.listing_id)?.title ?? b.listing_id}</span>
                <span className="text-muted">{b.slot}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6 space-y-3">
        <h2 className="text-xl text-nile">Consent records</h2>
        {consents.length === 0 ? (
          <p className="text-sm text-muted">None.</p>
        ) : (
          <ul className="text-sm divide-y divide-line">
            {consents.map((c) => (
              <li key={c.id} className="py-2 flex justify-between gap-4">
                <span>Identity check consent · wording {c.wording_version}</span>
                <span className="text-muted">{fmt(c.accepted_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6 space-y-3">
        <h2 className="text-xl text-nile">Your data rights</h2>
        <p className="text-sm text-muted">You can ask to see, correct or delete your data at any time. Deleting removes it from Grid and Didit.</p>
        <form action={requestErasureAction}>
          <button className="btn btn-ghost" type="submit">Request deletion of my verification data</button>
        </form>
      </section>
    </div>
  );
}
