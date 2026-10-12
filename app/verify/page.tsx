import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getListing } from "@/lib/data";
import { currentUser } from "@/lib/server/session";
import { dbConfigured } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { findReusable, latestVerification } from "@/lib/server/kyc";
import { ConsentFlow } from "@/components/ConsentFlow";
import { DbMissing, Notice } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify your identity" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function VerifyPage({ searchParams }: Props) {
  if (!dbConfigured()) return <DbMissing />;
  const sp = await searchParams;
  const listing = getListing(sp.listing);
  const user = await currentUser();

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
    <div className="max-w-xl mx-auto space-y-4">
      {sp.error === "consent" && <Notice tone="bad">Please tick the box to agree before continuing, or choose &quot;Not now&quot;.</Notice>}
      {sp.error === "id" && <Notice tone="bad">Please choose an ID type.</Notice>}
      <ConsentFlow listingId={listing?.id ?? ""} listingTitle={listing?.title ?? null} resumeId={resumeId} />
    </div>
  );
}
