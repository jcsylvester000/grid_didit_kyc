import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Check, Loader2, ScanFace, XCircle } from "lucide-react";
import { formatPhp, getListing } from "@/lib/data";
import { requireUser } from "@/lib/server/session";
import { findReusable } from "@/lib/server/kyc";
import { ESIGN_CONSENT, faceCheckMode, getDocument, getFaceCheck, refreshFaceCheck, roleIn } from "@/lib/server/documents";
import { startFaceCheckAction } from "@/app/doc-actions";
import { SignForm } from "@/components/DocForms";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ListingPhoto, Notice } from "@/components/ui";
import { listingPhotos } from "@/lib/photos";
import { Who } from "@/components/DiditGridLegend";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign document" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function SignPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/documents/${id}/sign`);
  const doc = await getDocument(id);
  if (!doc) notFound();
  const role = roleIn(doc, user.id);
  const myTurn = (role === "owner" && doc.status === "awaiting_owner") || (role === "broker" && doc.status === "awaiting_broker");
  if (!myTurn) redirect(`/documents/${doc.id}`);
  if (role === "owner" && (!doc.title_check || doc.title_check.status === "Declined")) redirect(`/documents/${doc.id}#title`);
  const v = await findReusable(user.id);
  if (!v) redirect(`/documents/${doc.id}`);

  let fc = sp.fc ? await getFaceCheck(sp.fc) : null;
  if (fc && (fc.user_id !== user.id || fc.document_id !== doc.id)) fc = null;
  if (fc) fc = await refreshFaceCheck(fc);
  const fresh = fc?.status === "approved" && fc.decided_at && Date.now() - new Date(fc.decided_at).getTime() < 15 * 60_000;
  const { mode, reason } = await faceCheckMode(user.id);
  const l = getListing(doc.listing_id);

  return (
    <div className="page grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
      {fc?.status === "pending" && fc.mode === "live" && <AutoRefresh />}
      <aside className="min-w-0 space-y-4">
        <Link href={`/documents/${doc.id}`} className="text-sm text-muted hover:text-nile">← Back to the document</Link>
        <div className="card overflow-hidden">
          <ListingPhoto photo={listingPhotos(doc.listing_id)[0]} sizes="(min-width:1024px) 40vw, 100vw" className="h-40" />
          <div className="p-5 space-y-2 text-sm">
            <p className="eyebrow">You are signing as {role}</p>
            <h1 className="text-2xl text-nile">{doc.terms.exclusive ? "Exclusive " : ""}Authority to Sell</h1>
            <p className="font-medium">{l?.title}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 pt-2">
              <dt className="text-muted">Owner</dt><dd>{doc.parties.owner?.verifiedName ?? doc.owner_name}</dd>
              <dt className="text-muted">Broker</dt><dd>{doc.parties.broker?.verifiedName ?? doc.broker_name}</dd>
              <dt className="text-muted">Asking price</dt><dd>{formatPhp(doc.terms.salePricePhp)}</dd>
              <dt className="text-muted">Commission</dt><dd>{doc.terms.commissionPct}%</dd>
              <dt className="text-muted">Valid</dt><dd>{doc.terms.startDate} to {doc.terms.endDate}</dd>
            </dl>
            <p className="text-xs text-muted break-all pt-2">Fingerprint: {doc.content_hash}</p>
          </div>
        </div>
      </aside>

      <section className="min-w-0 space-y-5">
        {sp.error && <Notice tone="bad">{sp.error}</Notice>}

        {/* Step 1: face check */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl text-nile flex items-center gap-2"><ScanFace size={20} className="text-muesli" aria-hidden /> 1. Confirm it&apos;s you</h2>
            <Who by="didit" />
          </div>
          {fresh ? (
            <p className="flex items-center gap-2 text-ok font-medium"><Check size={18} aria-hidden /> Face check passed{fc!.mode === "simulated" ? " (simulated)" : fc!.didit_session_number ? ` · Didit #${fc!.didit_session_number}` : ""}</p>
          ) : fc?.status === "pending" && fc.mode === "live" ? (
            <p className="flex items-center gap-2 text-nile"><Loader2 size={18} className="animate-spin" aria-hidden /> Waiting for Didit&apos;s result…</p>
          ) : (
            <>
              {fc?.status === "declined" && <p className="flex items-center gap-2 text-bad text-sm"><XCircle size={16} aria-hidden /> The face check didn&apos;t pass. Try again in good light, facing the camera.</p>}
              {fc?.status === "approved" && !fresh && <p className="text-sm text-wait">Your last face check is older than 15 minutes. Please do a new one.</p>}
              <p className="text-sm text-muted">
                Didit compares a quick selfie with the face from your identity check, so only you can sign. It takes about 5 seconds.
              </p>
              {mode === "simulated" && <p className="text-xs rounded-lg bg-wait-soft text-wait px-3 py-2">Simulated: {reason}</p>}
              <form action={startFaceCheckAction}>
                <input type="hidden" name="documentId" value={doc.id} />
                <button className="btn btn-primary w-full">Start face check</button>
              </form>
            </>
          )}
        </div>

        {/* Step 2: sign */}
        <div className={`card p-6 space-y-4 ${fresh ? "" : "opacity-60"}`} aria-disabled={!fresh}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl text-nile">2. Draw your signature</h2>
            <Who by="grid" />
          </div>
          {fresh ? (
            <SignForm documentId={doc.id} faceCheckId={fc!.id} consentText={ESIGN_CONSENT} role={role!} />
          ) : (
            <p className="text-sm text-muted">Available after the face check.</p>
          )}
        </div>
      </section>
    </div>
  );
}
