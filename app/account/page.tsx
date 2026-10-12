import Link from "next/link";
import type { Metadata } from "next";
import { getListing, idTypeLabel } from "@/lib/data";
import { requireUser } from "@/lib/server/session";
import { journeyFor } from "@/lib/server/journey";
import { JourneyTracker } from "@/components/JourneyTracker";
import { logoutAction } from "@/app/actions";
import { dbConfigured, q } from "@/lib/server/db";
import { findReusable, userBookings, userVerifications } from "@/lib/server/kyc";
import { DbMissing, ListingPhoto, Notice, OutcomeChip, VerifiedBadge } from "@/components/ui";
import { listingPhotos } from "@/lib/photos";
import { requestErasureAction } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }) : "—");

export default async function AccountPage({ searchParams }: Props) {
  if (!dbConfigured()) return <DbMissing />;
  const sp = await searchParams;
  const user = await requireUser("/account");
  const [journey, verified, history, bookings, consents] = await Promise.all([
    journeyFor(user.id),
    findReusable(user.id),
    userVerifications(user.id),
    userBookings(user.id),
    q<{ id: string; wording_version: string; accepted_at: string; listing_id: string | null }>(
      `SELECT id, wording_version, accepted_at, listing_id FROM kyc_consents WHERE user_id = $1 ORDER BY accepted_at DESC LIMIT 10`,
      [user.id],
    ),
  ]);

  return (
    <div className="page space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <span className="grid place-items-center size-16 rounded-full bg-nile text-white font-display text-2xl" aria-hidden>
          {user.name.split(" ").map((w) => w[0]).join("")}
        </span>
        <div>
          <p className="eyebrow">My account</p>
          <h1 className="text-3xl text-nile">{user.name}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="card p-6 space-y-4" aria-labelledby="progress-h">
          <h2 id="progress-h" className="text-xl text-nile">Your progress</h2>
          {journey && <JourneyTracker journey={journey} />}
          {!verified && (
            <Link href="/?access=verified#listings" className="btn btn-ghost w-full">Browse Verified-only homes</Link>
          )}
        </section>
        <section className="card p-6 space-y-3" aria-labelledby="details-h">
          <h2 id="details-h" className="text-xl text-nile">Account details</h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between gap-4"><dt className="text-muted">Email</dt><dd className="font-medium truncate">{user.email}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Mobile</dt><dd className="font-medium">{user.phone ?? "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Member since</dt><dd className="font-medium">{fmt(user.created_at)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Last sign-in</dt><dd className="font-medium">{fmt(user.last_login_at)}</dd></div>
          </dl>
          <form action={logoutAction}><button className="btn btn-ghost w-full">Sign out</button></form>
        </section>
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
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-muted">Verified name</dt><dd className="font-medium">{verified.verified_name ?? (verified.reviewed_by ? "Confirmed by staff review" : "—")}</dd></div>
              <div><dt className="text-muted">Date of birth</dt><dd className="font-medium">{verified.date_of_birth ?? "—"}</dd></div>
              <div><dt className="text-muted">ID type</dt><dd className="font-medium">{verified.document_type ?? idTypeLabel(verified.id_type_chosen)}</dd></div>
              <div><dt className="text-muted">ID valid until</dt><dd className="font-medium">{verified.document_expiry ?? "—"}</dd></div>
              <div><dt className="text-muted">Verified on</dt><dd className="font-medium">{fmt(verified.decided_at)}</dd></div>
              <div><dt className="text-muted">Didit session</dt><dd className="font-medium">{verified.didit_session_number ? `#${verified.didit_session_number}` : verified.mode === "seed" ? "Sample record" : verified.mode === "mock" ? "Simulated (mock mode)" : "—"}</dd></div>
            </dl>
          </>
        ) : history[0] && ["review", "pending", "in_progress", "retry"].includes(history[0].outcome) ? (
          <Link href={`/verify/result?v=${history[0].id}`} className="btn btn-ghost">See status</Link>
        ) : (
          <p className="text-sm text-muted">Not needed yet. You&apos;ll be asked once, only when you book a Verified-only home.</p>
        )}
      </section>

      <section className="card p-6 space-y-3">
        <h2 className="text-xl text-nile">Viewings</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted">No viewings booked yet.</p>
        ) : (
          <ul className="text-sm divide-y divide-line">
            {bookings.map((b) => (
              <li key={b.id} className="py-3 flex items-center gap-4">
                <ListingPhoto photo={listingPhotos(b.listing_id)[0]} sizes="64px" className="size-12 rounded-lg shrink-0" />
                <span className="flex-1">{getListing(b.listing_id)?.title ?? b.listing_id}</span>
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
