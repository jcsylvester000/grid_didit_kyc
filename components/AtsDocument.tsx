import { BadgeCheck, ScanFace } from "lucide-react";
import { formatPhp, getListing } from "@/lib/data";
import type { DocRow, Signature } from "@/lib/server/documents";

const date = (d: string | null | undefined) =>
  d ? new Date(d.length === 10 ? d + "T00:00:00+08:00" : d).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila" }) : "—";
const dateTime = (d: string) => new Date(d).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

function SignatureBlock({ label, name, sub, sig }: { label: string; name: string; sub: string; sig?: Signature }) {
  return (
    <div className="space-y-2">
      <div className="h-24 border-b border-midnight/60 flex items-end">
        {sig ? (
          <svg viewBox="0 0 600 200" className="h-24 w-auto max-w-full" role="img" aria-label={`Signature of ${name}`}>
            <path d={sig.signature_svg} fill="none" stroke="#0e192f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="text-xs text-muted pb-2">Awaiting signature</span>
        )}
      </div>
      <p className="font-semibold uppercase text-sm">{name}</p>
      <p className="text-xs text-muted">{label} · {sub}</p>
      {sig && (
        <p className="text-[11px] text-ok flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><BadgeCheck size={12} aria-hidden /> Identity verified (Didit)</span>
          <span className="inline-flex items-center gap-1"><ScanFace size={12} aria-hidden /> Face check {sig.face_mode === "live" ? `#${sig.face_session_number ?? "—"}` : "(simulated)"}</span>
          <span className="text-muted">Signed {dateTime(sig.signed_at)}</span>
        </p>
      )}
    </div>
  );
}

/** The agreement as both parties see and sign it. Plain-language sample, not a legal template. */
export function AtsDocument({ doc, signatures }: { doc: DocRow; signatures: Signature[] }) {
  const l = getListing(doc.listing_id);
  const t = doc.terms;
  const owner = doc.parties.owner;
  const broker = doc.parties.broker;
  const ownerName = owner?.verifiedName ?? owner?.accountName ?? doc.owner_name ?? "—";
  const brokerName = broker?.verifiedName ?? broker?.accountName ?? doc.broker_name ?? "—";
  const sig = (role: "owner" | "broker") => signatures.find((s) => s.role === role);
  const titleNo = doc.title_check?.status !== "Declined" ? doc.title_check?.titleNumber : null;

  return (
    <article className="ats-paper relative bg-white border border-line rounded-[14px] shadow-[var(--shadow-card)] px-6 sm:px-12 py-10 font-serif text-[15.5px] leading-relaxed text-midnight">
      {doc.status !== "completed" && (
        <span className="absolute top-4 right-4 font-sans text-[11px] uppercase tracking-wider rounded-full bg-wait-soft text-wait px-3 py-1">
          {doc.status === "draft" ? "Draft" : doc.status === "cancelled" ? "Cancelled" : "Awaiting signatures"}
        </span>
      )}
      <header className="text-center space-y-1 mb-8">
        <p className="font-sans text-xs uppercase tracking-[0.25em] text-muesli-text">GRID Property Ventures · Sample document</p>
        <h2 className="text-3xl font-display text-nile">{t.exclusive ? "Exclusive " : ""}Authority to Sell</h2>
        <p className="font-sans text-xs text-muted">Document {doc.id.slice(0, 8).toUpperCase()} · {doc.template_version}</p>
      </header>

      <ol className="space-y-4 list-decimal pl-5 marker:font-sans marker:text-muesli-text">
        <li>
          <b>Appointment.</b> I, <b>{ownerName}</b>, of legal age, whose identity was verified through Grid&apos;s partner Didit
          {owner?.idType ? ` using a ${owner.idType}` : ""}, appoint <b>{brokerName}</b>
          {broker?.prc ? `, Real Estate Broker, PRC Registration ${broker.prc},` : ","} as my {t.exclusive ? "exclusive " : ""}broker to market and find a buyer for the property below.
        </li>
        <li>
          <b>Property.</b> {l?.type ?? "Property"} known as &ldquo;{l?.title ?? doc.listing_id}&rdquo;, located at {l?.exactAddress ?? "—"}, with a floor area of about {l?.sqm ?? "—"} sqm
          {titleNo ? <>, covered by <b>{titleNo}</b></> : ", covered by the title copy provided by the Owner"}.
        </li>
        <li>
          <b>Asking price.</b> {formatPhp(t.salePricePhp)}, negotiable. The Broker may not accept any offer or change the price without my written approval.
        </li>
        <li>
          <b>Commission.</b> {t.commissionPct}% of the final selling price, earned when the Deed of Absolute Sale is signed with a buyer the Broker introduced
          {t.exclusive ? ", including a sale I make directly during the term" : ""}.
        </li>
        <li>
          <b>Validity.</b> From {date(t.startDate)} to {date(t.endDate)} ({t.termMonths} months){t.exclusive ? ". After that, it becomes non-exclusive unless renewed in writing" : ""}.
        </li>
        <li>
          <b>Owner&apos;s statements.</b> I am the registered owner (or am authorized to sell), and I will disclose any loans, liens or claims on the property.
        </li>
        <li>
          <b>Broker&apos;s duties.</b> The Broker will act under the Real Estate Service Act (RA 9646), present all offers, and will not collect deposits or payments
          outside Grid&apos;s approved payment channels.
        </li>
        <li>
          <b>Privacy.</b> Both parties consent to Grid processing their personal data to complete this transaction, under the Data Privacy Act (RA 10173).
        </li>
        <li>
          <b>Electronic signatures.</b> The parties sign electronically (Electronic Commerce Act, RA 8792). Either party may have this document notarized by a notary
          public or an accredited electronic notary.
        </li>
      </ol>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 mt-12 font-sans">
        <SignatureBlock label="Owner" name={ownerName} sub={owner?.idType ? `Verified · ${owner.idType}` : "Not yet verified"} sig={sig("owner")} />
        <SignatureBlock label="Broker" name={brokerName} sub={broker?.prc ? `PRC ${broker.prc}` : "Broker"} sig={sig("broker")} />
      </div>

      <footer className="mt-10 pt-4 border-t border-line font-sans text-[11px] text-muted space-y-1 break-all">
        <p>Content fingerprint (SHA-256): {doc.content_hash ?? "set when the broker sends the document"}</p>
        {doc.final_hash && <p>Completion seal (SHA-256): {doc.final_hash}</p>}
        <p>Sample for an internal prototype. Not legal advice; have counsel approve the final wording.</p>
      </footer>
    </article>
  );
}
