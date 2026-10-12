import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BedDouble, Bath, Ruler, MapPin, Lock, LockOpen, CalendarCheck } from "lucide-react";
import { getListing, formatPhp } from "@/lib/data";
import { AccessBadge, ListingPhoto, Notice, OutcomeChip, OwnerBadge, VerifiedBadge, DbMissing } from "@/components/ui";
import { listingPhotos } from "@/lib/photos";
import { currentUser } from "@/lib/server/session";
import { dbConfigured } from "@/lib/server/db";
import { findReusable, latestVerification, userBookings } from "@/lib/server/kyc";
import { bookViewingAction } from "@/app/actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = getListing((await params).id);
  return { title: l?.title ?? "Listing" };
}

export default async function ListingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const listing = getListing(id);
  if (!listing) notFound();
  if (!dbConfigured()) return <DbMissing />;

  const user = await currentUser();
  const [verified, latest, bookings] = user
    ? await Promise.all([findReusable(user.id), latestVerification(user.id), userBookings(user.id)])
    : [null, null, []];
  const booked = bookings.filter((b) => b.listing_id === listing.id);
  const waiting = !verified && latest && ["review", "pending", "in_progress"].includes(latest.outcome) ? latest : null;
  // Open listings show everything to everyone. Verified-only listings unlock after a passed ID check.
  const addressVisible = !listing.requiresKyc || Boolean(verified);
  const canBook = Boolean(user) && addressVisible;
  const loginHref = `/login?next=${encodeURIComponent(`/listings/${listing.id}`)}`;

  const photos = listingPhotos(listing.id);

  return (
    <div className="page space-y-6">
      <Link href="/#listings" className="text-sm text-muted hover:text-nile">← All listings</Link>

      {/* Gallery */}
      <div className="grid grid-cols-4 grid-rows-2 gap-2 sm:gap-3 h-[260px] sm:h-[420px] rounded-[22px] overflow-hidden">
        <ListingPhoto photo={photos[0]} sizes="(min-width:1024px) 66vw, 100vw" priority className="col-span-4 sm:col-span-3 row-span-2" />
        {photos.slice(1, 3).map((ph) => (
          <ListingPhoto key={ph.src} photo={ph} sizes="25vw" className="hidden sm:block" />
        ))}
      </div>
      <p className="text-xs text-muted -mt-3">Sample photos (Unsplash): {photos.map((p) => p.credit).join(", ")}.</p>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8">
      <article className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {listing.ownerAuthorized && <OwnerBadge />}
            <AccessBadge requiresKyc={listing.requiresKyc} unlocked={Boolean(verified)} />
            <span className="text-xs text-muted">{listing.type} · {listing.owner}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl text-nile">{listing.title}</h1>
          <p className="text-2xl font-semibold">{formatPhp(listing.rentPhp)}<span className="text-base font-normal text-muted"> / month</span></p>
          <p className="text-muted flex items-center gap-1.5"><MapPin size={16} aria-hidden /> {listing.area}</p>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          {[
            { Icon: BedDouble, k: "Bedrooms", v: listing.beds ? String(listing.beds) : "Studio" },
            { Icon: Bath, k: "Bathrooms", v: String(listing.baths) },
            { Icon: Ruler, k: "Floor area", v: `${listing.sqm} sqm` },
          ].map(({ Icon, k, v }) => (
            <div key={k} className="card p-4">
              <Icon size={18} className="text-muesli" aria-hidden />
              <dt className="text-xs text-muted mt-2">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        {listing.ownerAuthorized && (
          <p className="text-sm text-muted border-l-2 border-muesli pl-3">
            <b className="text-midnight">Owner-Authorized</b> means the owner verified their identity and their name matches the title copy they uploaded.
            Before paying anything, ask for a Certified True Copy of the title from the Registry of Deeds.
          </p>
        )}
      </article>

      <aside className="space-y-4 lg:sticky lg:top-6 self-start">
        {sp.reused && verified && (
          <Notice tone="ok">You&apos;re already verified, so we reused your earlier check. No new check was needed.</Notice>
        )}
        {sp.booked && <Notice tone="ok">Viewing booked. The owner has been notified.</Notice>}

        {addressVisible ? (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl text-nile flex items-center gap-2"><LockOpen size={18} aria-hidden /> Exact address</h2>
              {listing.requiresKyc ? <VerifiedBadge /> : <AccessBadge requiresKyc={false} />}
            </div>
            <p className="font-medium">{listing.exactAddress}</p>
            {!listing.requiresKyc && (
              <p className="text-xs text-muted">Open listing: the owner shares full details with everyone. No ID check needed to book.</p>
            )}
            {canBook ? (
              <form action={bookViewingAction} className="space-y-3">
                <input type="hidden" name="listingId" value={listing.id} />
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium mb-1">Choose a viewing slot</legend>
                  {listing.slots.map((s, i) => {
                    const taken = booked.some((b) => b.slot === s);
                    return (
                      <label key={s} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 has-[:checked]:border-nile has-[:checked]:bg-nile-soft">
                        <input type="radio" name="slot" value={s} defaultChecked={i === 0 && !taken} disabled={taken} required />
                        <span className="text-sm">{s}</span>
                        {taken && <span className="ml-auto text-xs text-ok flex items-center gap-1"><CalendarCheck size={14} aria-hidden /> Booked</span>}
                      </label>
                    );
                  })}
                </fieldset>
                <button className="btn btn-primary w-full" type="submit">Book this viewing</button>
              </form>
            ) : (
              <div className="space-y-2">
                <Link href={loginHref} className="btn btn-primary w-full">Sign in to book a viewing</Link>
                <p className="text-xs text-muted text-center">New here? <Link className="underline" href={`/register?next=${encodeURIComponent(`/listings/${listing.id}`)}`}>Create a free account</Link>. No ID needed.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl text-nile flex items-center gap-2"><Lock size={18} aria-hidden /> Exact address hidden</h2>
              <AccessBadge requiresKyc />
            </div>
            <p className="text-sm text-muted">
              The owner of this home accepts <b className="text-midnight">verified renters only</b>. Grid confirms your identity once before you see the
              exact address or book. It takes about a minute, and it&apos;s reused for every future viewing.
            </p>
            {!user ? (
              <div className="space-y-2">
                <Link href={loginHref} className="btn btn-primary w-full">Sign in to book a viewing</Link>
                <p className="text-xs text-muted text-center">New here? <Link className="underline" href={`/register?next=${encodeURIComponent(`/listings/${listing.id}`)}`}>Create a free account</Link> first. No ID needed to sign up.</p>
              </div>
            ) : waiting ? (
              <div className="space-y-3">
                <OutcomeChip outcome={waiting.outcome} />
                <p className="text-sm text-muted">
                  {waiting.outcome === "review" && "A Grid team member is reviewing your ID. We'll notify you by SMS and email."}
                  {waiting.outcome === "pending" && "Our ID check service was busy. Your request is saved."}
                  {waiting.outcome === "in_progress" && "You started a check but haven't finished it."}
                </p>
                <Link href={`/verify/result?v=${waiting.id}`} className="btn btn-ghost w-full">See status</Link>
              </div>
            ) : (
              <Link href={`/verify?listing=${listing.id}`} className="btn btn-primary w-full">Book a viewing</Link>
            )}
            <p className="text-xs text-muted">You can keep browsing and booking Open listings without verifying.</p>
          </div>
        )}
      </aside>
      </div>
    </div>
  );
}
