import Link from "next/link";
import type { Metadata } from "next";
import { FilePlus2, FileSignature } from "lucide-react";
import { getListing } from "@/lib/data";
import { requireUser } from "@/lib/server/session";
import { dbConfigured } from "@/lib/server/db";
import { findReusable } from "@/lib/server/kyc";
import { documentsForUser } from "@/lib/server/documents";
import { DbMissing, ListingPhoto, Notice, VerifiedBadge } from "@/components/ui";
import { listingPhotos } from "@/lib/photos";
import { RESPONSIBILITIES, Who, STATUS_LABEL } from "@/components/DiditGridLegend";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Documents" };


export default async function DocumentsPage() {
  if (!dbConfigured()) return <DbMissing />;
  const user = await requireUser("/documents");
  const [docs, verified] = await Promise.all([documentsForUser(user.id), findReusable(user.id)]);

  return (
    <div className="page space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Document transactions</p>
          <h1 className="text-3xl sm:text-4xl text-nile">Authority to Sell</h1>
          <p className="text-muted mt-2 max-w-2xl">
            A broker drafts it, the owner adds a title copy and signs, the broker countersigns. Every signer is a Didit-verified person who passes a quick face check at the moment of signing.
          </p>
        </div>
        {user.role === "broker" && verified && (
          <Link href="/documents/new" className="btn btn-primary"><FilePlus2 size={16} aria-hidden /> New Authority to Sell</Link>
        )}
      </div>

      {!verified && (
        <Notice tone="wait">
          You need a verified identity to draft or sign documents. <Link href="/verify" className="underline font-medium">Verify now</Link> (about a minute, done once).
        </Notice>
      )}
      {user.role !== "broker" && verified && docs.length === 0 && (
        <Notice tone="info">Nothing to sign yet. When a broker sends you an Authority to Sell, it appears here. (Demo: sign in as liza@example.com to draft one.)</Notice>
      )}

      <section aria-labelledby="mine-h" className="space-y-3">
        <h2 id="mine-h" className="text-xl text-nile flex items-center gap-2">
          Your documents {verified && <VerifiedBadge />}
        </h2>
        {docs.length === 0 ? (
          <p className="text-sm text-muted">No documents yet.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 [&>li]:min-w-0">
            {docs.map((d) => {
              const l = getListing(d.listing_id);
              const s = STATUS_LABEL[d.status];
              const yourTurn = (d.status === "awaiting_owner" && d.owner_id === user.id) || (d.status === "awaiting_broker" && d.broker_id === user.id) || (d.status === "draft" && d.broker_id === user.id);
              return (
                <li key={d.id}>
                  <Link href={`/documents/${d.id}`} className="card flex gap-4 p-4 hover:border-muesli transition-colors">
                    <ListingPhoto photo={listingPhotos(d.listing_id)[0]} sizes="96px" className="size-20 rounded-xl shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full text-xs font-medium px-2.5 py-0.5 ${s.cls}`}>{s.label}</span>
                        {yourTurn && <span className="rounded-full text-xs font-medium px-2.5 py-0.5 bg-nile text-white">Your turn</span>}
                      </div>
                      <p className="font-medium truncate flex items-center gap-1.5"><FileSignature size={15} className="text-muesli shrink-0" aria-hidden /> {d.terms.exclusive ? "Exclusive " : ""}Authority to Sell</p>
                      <p className="text-sm text-muted truncate">{l?.title}</p>
                      <p className="text-xs text-muted truncate">Owner {d.owner_name} · Broker {d.broker_name}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="who-h" className="card p-6 space-y-4">
        <div>
          <h2 id="who-h" className="text-xl text-nile">Who does what in a document transaction</h2>
          <p className="text-sm text-muted">Didit has no e-signature product. It proves who is signing and checks uploaded documents; Grid runs the document itself.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="table-tight w-full">
            <thead><tr><th>Step</th><th>Handled by</th><th>How</th></tr></thead>
            <tbody>
              {RESPONSIBILITIES.map((r) => (
                <tr key={r.step}><td className="font-medium">{r.step}</td><td><Who by={r.by} /></td><td className="text-muted">{r.how}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
