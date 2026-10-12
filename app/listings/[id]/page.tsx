import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BedDouble, Bath, Ruler, MapPin, Lock, LockOpen, CalendarCheck } from "lucide-react";
import { getListing, formatPhp } from "@/lib/data";
import { ListingArt, Notice, OutcomeChip, OwnerBadge, VerifiedBadge, DbMissing } from "@/components/ui";
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
  const [verified, latest, bookings] = await Promise.all([findReusable(user.id), latestVerification(user.id), userBookings(user.id)]);
  const booked = bookings.filter((b) => b.listing_id === listing.id);
  const waiting = !verified && latest && ["review", "pending", "in_progress"].includes(latest.outcome) ? latest : null;

  return (
    <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8">
      <article className="space-y-6">
        <Link href="/" className="text-sm text-muted hover:text-nile">← All listings</Link>
        <div className="card overflow-hidden">
          <ListingArt tint={listing.tint} label={`Illustration for ${listing.title}`} />
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {listing.ownerAuthorized && <OwnerBadge />}
            <span className="text-xs text-muted">{listing.type} · {listing.owner}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl text-nile">{listing.title}</h1>
          <p className="text-2xl font-semibold">{formatPhp(listing.rentPhp)}<span className="text-base font-normal text-muted"> / month</span></p>
          <p className="text-muted flex items-center gap-1.5"><MapPin size={16} aria-hidden /> {listing.area}</p>
          <p className="text-sm text-muted flex gap-5">
            <span className="flex items-center gap-1.5"><BedDouble size={16} aria-hidden /> {listing.beds ? `${listing.beds} bedroom` : "Studio"}</span>
            <span className="flex items-center gap-1.5"><Bath size={16} aria-hidden /> {listing.baths} bath</span>
            <span className="flex items-center gap-1.5"><Ruler size={16} aria-hidden /> {listing.sqm} sqm</span>
          </p>
        </div>
        {listing.ownerAuthorized && (
          <p className="text-xs text-muted border-l-2 border-muesli pl-3">
            Owner-Authorized means the owner verified their identity and their name matches the title copy they uploaded. Before paying
            anything, ask for a Certified True Copy of the title from the Registry of Deeds.
          </p>
        )}
      </article>

      <aside className="space-y-4 lg:pt-10">
        {sp.reused && verified && (
          <Notice tone="ok">You&apos;re already verified, so we reused your earlier check. No new check was needed.</Notice>
        )}
        {sp.booked && <Notice tone="ok">Viewing booked. The owner has been notified.</Notice>}

        {verified ? (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl text-nile flex items-center gap-2"><LockOpen size={18} aria-hidden /> Exact address</h2>
              <VerifiedBadge />
            </div>
            <p className="font-medium">{listing.exactAddress}</p>
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
          </div>
        ) : (
          <div className="card p-5 space-y-4">
            <h2 className="text-xl text-nile flex items-center gap-2"><Lock size={18} aria-hidden /> Exact address hidden</h2>
            <p className="text-sm text-muted">
              To protect owners and tenants, Grid confirms your identity once before you see the exact address or book a viewing.
              It takes about a minute.
            </p>
            {waiting ? (
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
            <p className="text-xs text-muted">You can keep browsing, saving and messaging without verifying.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
