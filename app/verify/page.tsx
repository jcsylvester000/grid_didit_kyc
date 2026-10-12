import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getListing } from "@/lib/data";
import { requireUser } from "@/lib/server/session";
import { dbConfigured } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { findReusable, latestVerification } from "@/lib/server/kyc";
import { ConsentFlow } from "@/components/ConsentFlow";
import { DbMissing, Notice, ListingPhoto } from "@/components/ui";
import { VERIFY_PHOTO, listingPhotos } from "@/lib/photos";
import Image from "next/image";
import { ShieldCheck, Clock, Repeat } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify your identity" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function VerifyPage({ searchParams }: Props) {
  if (!dbConfigured()) return <DbMissing />;
  const sp = await searchParams;
  const listing = getListing(sp.listing);
  const user = await requireUser(`/verify?listing=${listing?.id ?? ""}`);
  // Open listings never need an ID check (verify at the moment of value).
  if (listing && !listing.requiresKyc) redirect(`/listings/${listing.id}`);

  // Rule 2: a verified user never repeats the full check. Skip consent + Didit entirely.
  const reusable = await findReusable(user.id);
  if (reusable) {
    await audit(`user:${user.id}`, "verification.reused", { userId: user.id, verificationId: reusable.id, detail: { listingId: listing?.id ?? null } });
    redirect(listing ? `/listings/${listing.id}?reused=1` : "/account");
  }

  const latest = await latestVerification(user.id);
  if (latest?.outcome === "review") redirect(`/verify/result?v=${latest.id}`);
  const resumeId = latest && ["pending", "retry", "in_progress"].includes(latest.outcome) ? latest.id : null;

  return (
    <div className="page grid grid-cols-1 lg:grid-cols-[1fr_0.9fr] gap-8 items-start">
      <div className="space-y-4 min-w-0">
        {sp.error === "consent" && <Notice tone="bad">Please tick the box to agree before continuing, or choose &quot;Not now&quot;.</Notice>}
        {sp.error === "id" && <Notice tone="bad">Please choose an ID type.</Notice>}
        {listing && (
          <div className="card flex items-center gap-4 p-3">
            <ListingPhoto photo={listingPhotos(listing.id)[0]} sizes="96px" className="size-16 rounded-xl shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted">Booking a viewing</p>
              <p className="font-medium truncate">{listing.title}</p>
              <p className="text-xs text-muted truncate">{listing.area}</p>
            </div>
          </div>
        )}
        <ConsentFlow listingId={listing?.id ?? ""} listingTitle={listing?.title ?? null} resumeId={resumeId} />
      </div>
      <aside className="hidden lg:block sticky top-6">
        <div className="relative aspect-[4/5] rounded-[22px] overflow-hidden shadow-xl">
          <Image src={VERIFY_PHOTO.src} alt={VERIFY_PHOTO.alt} fill sizes="40vw" className="object-cover" />
          <div className="absolute inset-0 photo-scrim" />
          <ul className="absolute bottom-5 left-5 right-5 glass rounded-xl p-5 text-white text-sm space-y-3">
            <li className="flex gap-3"><Clock size={18} className="text-burly shrink-0" aria-hidden /> About a minute, done once.</li>
            <li className="flex gap-3"><ShieldCheck size={18} className="text-burly shrink-0" aria-hidden /> Your ID photo and selfie stay with Didit. Grid keeps only the result.</li>
            <li className="flex gap-3"><Repeat size={18} className="text-burly shrink-0" aria-hidden /> Reused for every future viewing, free.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
