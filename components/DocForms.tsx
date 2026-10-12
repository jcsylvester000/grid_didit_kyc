"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eraser, FileUp } from "lucide-react";
import { createAtsAction, signAction, titleCheckAction, type DocFormState } from "@/app/doc-actions";

function Submit({ label, busy, disabled = false }: { label: string; busy: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending || disabled}>
      {pending ? busy : label}
    </button>
  );
}
const ErrorLine = ({ error }: { error: string | null }) =>
  error ? <p role="alert" className="rounded-xl bg-bad-soft text-bad text-sm px-4 py-3">{error}</p> : null;

/* ---------------------------------------------------------------- signature pad */

const W = 600;
const H = 200;

/** Drawn signature → compact SVG path ("M x y L x y …") in a 600×200 box. Mouse, pen and touch. */
export function SignaturePad({ name, onChange }: { name: string; onChange?: (hasInk: boolean) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [path, setPath] = useState("");
  const drawing = useRef(false);

  const point = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  };
  useEffect(() => onChange?.(path.length > 40), [path, onChange]);

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border-2 border-dashed border-iron bg-white touch-none select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block cursor-crosshair"
          role="img"
          aria-label="Signature drawing area. Draw your signature with a mouse, pen or finger."
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            drawing.current = true;
            setPath((p) => `${p} M ${point(e)}`.trim());
          }}
          onPointerMove={(e) => {
            if (drawing.current) setPath((p) => `${p} L ${point(e)}`);
          }}
          onPointerUp={() => (drawing.current = false)}
          onPointerLeave={() => (drawing.current = false)}
        >
          <line x1="30" y1="160" x2="570" y2="160" stroke="#d2d2d2" strokeWidth="2" />
          <text x="30" y="185" fontSize="14" fill="#5a6478">Sign above the line</text>
          <path d={path || "M 0 0"} fill="none" stroke="#0e192f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <input type="hidden" name={name} value={path} />
      <button type="button" onClick={() => setPath("")} className="text-sm text-muted hover:text-nile inline-flex items-center gap-1">
        <Eraser size={14} aria-hidden /> Clear signature
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- sign form */

export function SignForm({ documentId, faceCheckId, consentText, role }: { documentId: string; faceCheckId: string; consentText: string; role: string }) {
  const [state, action] = useActionState<DocFormState, FormData>(signAction, { error: null });
  const [ink, setInk] = useState(false);
  const [agree, setAgree] = useState(false);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="faceCheckId" value={faceCheckId} />
      <ErrorLine error={state.error} />
      <SignaturePad name="signature" onChange={setInk} />
      <label className="flex items-start gap-3 rounded-xl border border-iron p-4 text-sm has-[:checked]:border-nile has-[:checked]:bg-nile-soft">
        <input type="checkbox" name="consent" className="mt-1 size-4 accent-[#1c335e]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>{consentText}</span>
      </label>
      <Submit label={role === "broker" ? "Countersign and complete" : "Sign Authority to Sell"} busy="Sealing document…" disabled={!ink || !agree} />
    </form>
  );
}

/* ---------------------------------------------------------------- title copy */

export function TitleCheckForm({ documentId, live, scenarios }: { documentId: string; live: boolean; scenarios: Record<string, string> }) {
  const [state, action] = useActionState<DocFormState, FormData>(titleCheckAction, { error: null });
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="documentId" value={documentId} />
      <ErrorLine error={state.error} />
      <label className="flex items-center gap-3 rounded-xl border-2 border-dashed border-iron p-4 cursor-pointer hover:border-nile">
        <FileUp size={20} className="text-muesli shrink-0" aria-hidden />
        <span className="text-sm">
          <b className="block font-medium">Title copy (TCT / CCT)</b>
          <span className="text-muted">PDF or photo, up to 10 MB. {live ? "Sent to Didit, not stored by Grid." : "Optional in mock mode."}</span>
        </span>
        <input type="file" name="titleCopy" accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff" className="sr-only" required={live} />
      </label>
      {!live && (
        <fieldset className="space-y-2">
          <legend className="text-xs uppercase tracking-wider text-muted">Simulated Didit result</legend>
          {Object.entries(scenarios).map(([k, l], i) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="radio" name="scenario" value={k} defaultChecked={i === 0} /> {l}
            </label>
          ))}
        </fieldset>
      )}
      <Submit label="Check title copy with Didit" busy="Checking document…" />
    </form>
  );
}

/* ---------------------------------------------------------------- new ATS */

export function NewAtsForm({ listings, suggested, defaultOwnerEmail, today }: { listings: { id: string; label: string }[]; suggested: Record<string, number>; defaultOwnerEmail: string; today: string }) {
  const [state, action] = useActionState<DocFormState, FormData>(createAtsAction, { error: null });
  const [listingId, setListingId] = useState(listings[0]?.id ?? "");
  const [price, setPrice] = useState(String(suggested[listings[0]?.id] ?? ""));
  return (
    <form action={action} className="space-y-4">
      <ErrorLine error={state.error} />
      <div className="space-y-1.5">
        <label htmlFor="listingId" className="text-sm font-medium">Property</label>
        <select id="listingId" name="listingId" className="input" value={listingId} onChange={(e) => { setListingId(e.target.value); setPrice(String(suggested[e.target.value] ?? "")); }}>
          {listings.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="ownerEmail" className="text-sm font-medium">Owner&apos;s Grid account email</label>
        <input id="ownerEmail" name="ownerEmail" type="email" className="input" defaultValue={defaultOwnerEmail} required />
        <p className="text-xs text-muted">The owner must have a Grid account. They&apos;ll verify, add the title copy and sign.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="salePricePhp" className="text-sm font-medium">Asking price (₱)</label>
          <input id="salePricePhp" name="salePricePhp" inputMode="numeric" className="input" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="commissionPct" className="text-sm font-medium">Commission (%)</label>
          <input id="commissionPct" name="commissionPct" type="number" step="0.5" min="0.5" max="10" defaultValue="3" className="input" required />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="termMonths" className="text-sm font-medium">Valid for</label>
          <select id="termMonths" name="termMonths" defaultValue="6" className="input">
            <option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="startDate" className="text-sm font-medium">Start date</label>
          <input id="startDate" name="startDate" type="date" defaultValue={today} className="input" required />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Type</legend>
        <label className="flex items-start gap-2 text-sm"><input type="radio" name="exclusive" value="yes" defaultChecked className="mt-1" /> <span><b className="font-medium">Exclusive</b>: only this broker markets the property during the term.</span></label>
        <label className="flex items-start gap-2 text-sm"><input type="radio" name="exclusive" value="no" className="mt-1" /> <span><b className="font-medium">Non-exclusive</b>: the owner may appoint other brokers.</span></label>
      </fieldset>
      <Submit label="Create draft" busy="Creating draft…" />
    </form>
  );
}
