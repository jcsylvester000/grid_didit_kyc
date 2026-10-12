import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, BadgeCheck, Check, FileCheck2, PenLine, ShieldCheck, Stamp, XCircle } from "lucide-react";
import { AML_THRESHOLD_PHP, formatPhp, getListing } from "@/lib/data";
import { requireUser, isAdmin } from "@/lib/server/session";
import { isMockMode } from "@/lib/server/env";
import { findReusable } from "@/lib/server/kyc";
import { documentEvents, documentSignatures, getDocument, roleIn, TITLE_SCENARIOS } from "@/lib/server/documents";
import { cancelAtsAction, sendAtsAction } from "@/app/doc-actions";
import { AtsDocument } from "@/components/AtsDocument";
import { TitleCheckForm } from "@/components/DocForms";
import { PrintButton } from "@/components/PrintButton";
import { Notice } from "@/components/ui";
import { STATUS_LABEL, Who } from "@/components/DiditGridLegend";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Authority to Sell" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }) : "");

const EVENT_LABEL: Record<string, string> = {
  created: "Draft created",
  sent: "Sent to owner · content locked (SHA-256)",
  title_checked: "Title copy checked by Didit Document AI",
  face_check_started: "Face check started",
  face_check_passed: "Face check passed (Didit Biometric Authentication)",
  face_check_failed: "Face check did not pass",
  face_check_error: "Face check could not start",
  signed: "Signed",
  completed: "Completed · document sealed",
  cancelled: "Cancelled",
  integrity_failed: "Blocked: document changed after sending",
};

export default async function DocumentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/documents/${id}`);
  const doc = await getDocument(id);
  if (!doc) notFound();
  const role = roleIn(doc, user.id);
  if (!role && !(await isAdmin())) notFound();

  const [signatures, events, verified] = await Promise.all([documentSignatures(doc.id), documentEvents(doc.id), findReusable(user.id)]);
  const l = getListing(doc.listing_id);
  const ownerSig = signatures.find((s) => s.role === "owner");
  const brokerSig = signatures.find((s) => s.role === "broker");
  const tc = doc.title_check;
  const status = STATUS_LABEL[doc.status];
  const highValue = doc.terms.salePricePhp >= AML_THRESHOLD_PHP;

  const steps: { label: string; by: ("didit" | "grid" | "third")[]; done: boolean; note?: string }[] = [
    { label: "Broker drafts from verified data", by: ["grid"], done: true, note: fmt(doc.created_at) },
    { label: "Sent to owner, content locked", by: ["grid"], done: Boolean(doc.sent_at), note: fmt(doc.sent_at) },
    { label: "Title copy checked", by: ["didit"], done: Boolean(tc && tc.status !== "Declined"), note: tc ? `${tc.status}${tc.mode === "simulated" ? " (simulated)" : ""}` : undefined },
    { label: "Owner: face check + signature", by: ["didit", "grid"], done: Boolean(ownerSig), note: ownerSig ? fmt(ownerSig.signed_at) : undefined },
    { label: "Broker: face check + countersignature", by: ["didit", "grid"], done: Boolean(brokerSig), note: brokerSig ? fmt(brokerSig.signed_at) : undefined },
    { label: "Sealed and completed", by: ["grid"], done: doc.status === "completed", note: fmt(doc.completed_at) },
    { label: "Notarization (optional)", by: ["third"], done: false, note: "Outside Grid and Didit" },
  ];

  return (
    <div className="page space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/documents" className="text-sm text-muted hover:text-nile">← Documents</Link>
        <span className={`rounded-full text-xs font-medium px-3 py-1 ${status.cls}`}>{status.label}</span>
      </div>
      <div className="no-print space-y-3">
        {sp.sent && <Notice tone="ok">Sent to {doc.owner_name}. The agreement is now locked: any change would break its fingerprint.</Notice>}
        {sp.signed === "awaiting_broker" && <Notice tone="ok">Signed. The broker has been asked to countersign.</Notice>}
        {sp.signed === "completed" && <Notice tone="ok">Completed. Both parties signed and the document is sealed.</Notice>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        <div className="min-w-0"><AtsDocument doc={doc} signatures={signatures} /></div>

        <aside className="no-print space-y-4 min-w-0 lg:sticky lg:top-6">
          {/* Next action */}
          <section className="card p-5 space-y-3" aria-labelledby="action-h">
            <h2 id="action-h" className="text-lg text-nile">{role ? `You are the ${role}` : "Staff view"}</h2>

            {doc.status === "draft" && role === "broker" && (
              <>
                <p className="text-sm text-muted">Check the draft. Sending locks the text with a SHA-256 fingerprint and asks {doc.owner_name} to sign.</p>
                <form action={sendAtsAction}><input type="hidden" name="documentId" value={doc.id} /><button className="btn btn-primary w-full">Send to owner for signature</button></form>
                <form action={cancelAtsAction}><input type="hidden" name="documentId" value={doc.id} /><button className="btn btn-ghost w-full">Cancel draft</button></form>
              </>
            )}
            {doc.status === "draft" && role === "owner" && <p className="text-sm text-muted">The broker is still preparing this document.</p>}

            {doc.status === "awaiting_owner" && role === "owner" && (
              !verified ? (
                <><p className="text-sm text-muted">Verify your identity once before you can sign.</p><Link href="/verify" className="btn btn-primary w-full">Verify my identity</Link></>
              ) : !tc || tc.status === "Declined" ? (
                <div id="title" className="space-y-3 scroll-mt-20">
                  <p className="text-sm flex items-center gap-2"><Who by="didit" /> <span className="font-medium">Step 1: add your title copy</span></p>
                  <p className="text-sm text-muted">Didit Document AI reads the title, checks that it&apos;s in your verified name, and looks for signs of editing.</p>
                  <TitleCheckForm documentId={doc.id} live={!isMockMode()} scenarios={TITLE_SCENARIOS} />
                </div>
              ) : (
                <>
                  <p className="text-sm flex items-center gap-2"><Who by="didit" /><Who by="grid" /> <span className="font-medium">Step 2: sign</span></p>
                  <p className="text-sm text-muted">A 5-second face check confirms it&apos;s you, then you draw your signature.</p>
                  <Link href={`/documents/${doc.id}/sign`} className="btn btn-primary w-full"><PenLine size={16} aria-hidden /> Sign now</Link>
                </>
              )
            )}
            {doc.status === "awaiting_owner" && role === "broker" && <p className="text-sm text-muted">Waiting for {doc.owner_name} to add the title copy and sign.</p>}

            {doc.status === "awaiting_broker" && role === "broker" && (
              verified ? (
                <><p className="text-sm text-muted">The owner has signed. Countersign to complete and seal the document.</p>
                <Link href={`/documents/${doc.id}/sign`} className="btn btn-primary w-full"><PenLine size={16} aria-hidden /> Countersign</Link></>
              ) : (<Link href="/verify" className="btn btn-primary w-full">Verify my identity</Link>)
            )}
            {doc.status === "awaiting_broker" && role === "owner" && <p className="text-sm text-muted">You signed. Waiting for {doc.broker_name} to countersign.</p>}

            {doc.status === "completed" && (
              <>
                <p className="text-sm flex items-center gap-2 text-ok font-medium"><FileCheck2 size={16} aria-hidden /> Completed {fmt(doc.completed_at)}</p>
                <PrintButton />
                <button className="btn btn-ghost w-full" disabled title="Hand-off to a notary public or SC-accredited electronic notary">
                  <Stamp size={16} aria-hidden /> Send for notarization (third party)
                </button>
                <p className="text-xs text-muted">Notarization is optional for an ATS and is done by a notary public or an accredited electronic notary, not by Grid or Didit.</p>
              </>
            )}
            {doc.status === "cancelled" && <p className="text-sm text-muted">This draft was cancelled.</p>}
          </section>

          {/* Progress */}
          <section className="card p-5 space-y-3" aria-labelledby="steps-h">
            <h2 id="steps-h" className="text-lg text-nile">Progress</h2>
            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={s.label} className="flex gap-3">
                  <span className={`grid place-items-center size-7 rounded-full shrink-0 text-xs font-semibold ${s.done ? "bg-ok text-white" : "border border-iron text-muted"}`}>
                    {s.done ? <Check size={14} aria-hidden /> : i + 1}
                  </span>
                  <div className="text-sm min-w-0">
                    <p className="font-medium">{s.label}<span className="sr-only">{s.done ? " (done)" : ""}</span></p>
                    <p className="flex flex-wrap items-center gap-1.5 mt-0.5">{s.by.map((b) => <Who key={b} by={b} />)} {s.note && <span className="text-xs text-muted">{s.note}</span>}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Title check */}
          {tc && (
            <section className="card p-5 space-y-2 text-sm" aria-labelledby="tc-h">
              <h2 id="tc-h" className="text-lg text-nile flex items-center gap-2">Title copy check <Who by="didit" /></h2>
              <p className={`flex items-center gap-2 font-medium ${tc.status === "Approved" ? "text-ok" : tc.status === "Declined" ? "text-bad" : "text-wait"}`}>
                {tc.status === "Approved" ? <ShieldCheck size={16} aria-hidden /> : tc.status === "Declined" ? <XCircle size={16} aria-hidden /> : <AlertTriangle size={16} aria-hidden />}
                {tc.status === "Approved" ? "Name matches, no signs of editing" : tc.status === "Declined" ? "Name does not match the verified owner" : "Needs a closer look"}
                {tc.mode === "simulated" && <span className="text-xs text-muted font-normal">(simulated)</span>}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-muted">Title no.</dt><dd>{tc.titleNumber ?? "—"}</dd>
                <dt className="text-muted">Owner on title</dt><dd>{tc.ownerOnTitle ?? "—"}</dd>
                <dt className="text-muted">Name match</dt><dd>{tc.matchScore != null ? `${tc.matchScore}%` : "—"}</dd>
              </dl>
              {tc.warnings.length > 0 && <ul className="text-xs text-wait list-disc pl-5">{tc.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
              <p className="text-xs text-muted">Grid keeps only this result, not the file. Didit doesn&apos;t confirm titles with the Registry of Deeds; get a Certified True Copy before closing.</p>
            </section>
          )}

          {highValue && (
            <section className="card p-5 text-sm space-y-1">
              <p className="font-medium flex items-center gap-2"><AlertTriangle size={16} className="text-wait" aria-hidden /> High-value sale ({formatPhp(doc.terms.salePricePhp)})</p>
              <p className="text-muted">Above the ₱7.5M AMLA threshold: run AML screening on the buyer before closing (Didit AML Screening, US$0.20). Not run in this prototype.</p>
            </section>
          )}

          {/* Parties */}
          <section className="card p-5 space-y-2 text-sm" aria-labelledby="parties-h">
            <h2 id="parties-h" className="text-lg text-nile">Parties</h2>
            {(["owner", "broker"] as const).map((r) => {
              const p = doc.parties[r];
              return (
                <div key={r} className="flex items-start justify-between gap-3 py-1">
                  <div className="min-w-0">
                    <p className="font-medium">{p?.verifiedName ?? p?.accountName ?? (r === "owner" ? doc.owner_name : doc.broker_name)}</p>
                    <p className="text-xs text-muted">{r === "owner" ? "Owner" : "Broker"}{p?.prc ? ` · PRC ${p.prc}` : ""}</p>
                  </div>
                  {p?.verifiedName ? <span className="inline-flex items-center gap-1 text-xs text-ok"><BadgeCheck size={14} aria-hidden /> Verified</span> : <span className="text-xs text-wait">Not verified yet</span>}
                </div>
              );
            })}
            <p className="text-xs text-muted">Property: {l?.title}</p>
          </section>

          {/* Audit trail */}
          <section className="card p-5 space-y-2" aria-labelledby="trail-h">
            <h2 id="trail-h" className="text-lg text-nile">Audit trail</h2>
            <ol className="text-xs space-y-2 border-l border-line pl-4">
              {events.map((e) => (
                <li key={e.id}>
                  <p className="font-medium text-sm text-midnight">{EVENT_LABEL[e.action] ?? e.action}{e.detail.role ? ` (${e.detail.role})` : ""}{e.action === "title_checked" && e.detail.status ? `: ${e.detail.status}` : ""}</p>
                  <p className="text-muted">{fmt(e.at)} · {e.actor_name ?? "System"}{e.detail.mode ? ` · ${e.detail.mode}` : ""}</p>
                  {typeof e.detail.hash === "string" && <p className="text-muted break-all font-mono">{e.detail.hash.slice(0, 24)}…</p>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
