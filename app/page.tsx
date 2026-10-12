import Link from "next/link";
import { BedDouble, Bath, Ruler, MapPin, Lock } from "lucide-react";
import { LISTINGS, formatPhp } from "@/lib/data";
import { ListingArt, OwnerBadge, VerifiedBadge } from "@/components/ui";
import { currentUser } from "@/lib/server/session";
import { dbConfigured } from "@/lib/server/db";
import { findReusable } from "@/lib/server/kyc";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  const verified = dbConfigured() ? await findReusable(user.id).catch(() => null) : null;

  return (
    <div className="space-y-10">
      <section className="grid md:grid-cols-[1.4fr_1fr] gap-8 items-end">
        <div>
          <p className="eyebrow">GRID Verified rentals</p>
          <h1 className="text-4xl sm:text-5xl text-nile mt-1 leading-tight">Rent from owners who are who they say they are.</h1>
          <p className="mt-4 text-muted max-w-xl">
            Browse freely. We ask for a one-time ID check only when you book your first viewing, so owners know who is coming
            and you know the listing is authorized.
          </p>
        </div>
        <div className="card p-5 text-sm space-y-3">
          <p className="font-medium">Signed in as {user.name}</p>
          {verified ? (
            <p className="flex items-center gap-2">
              <VerifiedBadge /> <span className="text-muted">No need to verify again.</span>
            </p>
          ) : (
            <p className="text-muted">Not verified yet. Browsing, saving and messaging stay free.</p>
          )}
          <ol className="text-muted list-decimal pl-5 space-y-1">
            <li>Pick a listing and tap <b>Book a viewing</b>.</li>
            <li>Agree to a one-minute ID photo + selfie check with Didit.</li>
            <li>The exact address and viewing slots unlock.</li>
          </ol>
        </div>
      </section>

      <section aria-labelledby="listings-h">
        <h2 id="listings-h" className="text-2xl text-nile mb-4">Available now</h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {LISTINGS.map((l) => (
            <li key={l.id}>
              <Link href={`/listings/${l.id}`} className="card block overflow-hidden hover:border-muesli transition-colors">
                <ListingArt tint={l.tint} label={`Illustration for ${l.title}`} />
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-lg">{formatPhp(l.rentPhp)}<span className="text-sm font-normal text-muted">/mo</span></p>
                    {l.ownerAuthorized && <OwnerBadge />}
                  </div>
                  <p className="font-medium leading-snug">{l.title}</p>
                  <p className="text-sm text-muted flex items-center gap-1"><MapPin size={14} aria-hidden /> {l.area}</p>
                  <p className="text-xs text-muted flex items-center gap-3 pt-1">
                    <span className="flex items-center gap-1"><BedDouble size={14} aria-hidden /> {l.beds || "Studio"}</span>
                    <span className="flex items-center gap-1"><Bath size={14} aria-hidden /> {l.baths}</span>
                    <span className="flex items-center gap-1"><Ruler size={14} aria-hidden /> {l.sqm} sqm</span>
                    {!verified && <span className="flex items-center gap-1 ml-auto"><Lock size={13} aria-hidden /> Exact address</span>}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
