import type { DocStatus } from "@/lib/server/documents";

/** Small tags that show which system handles each step: Didit, Grid, or a third party. */
export function Who({ by }: { by: "didit" | "grid" | "third" }) {
  const s = { didit: "bg-info-soft text-info", grid: "bg-muesli-soft text-muesli-text", third: "bg-canvas text-muted border border-line" }[by];
  const l = { didit: "Didit", grid: "Grid", third: "Third party" }[by];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s}`}>{l}</span>;
}

export const RESPONSIBILITIES: { step: string; by: "didit" | "grid" | "third"; how: string }[] = [
  { step: "Signer is a real, verified person", by: "didit", how: "One-time ID + selfie check (already on file)" },
  { step: "The person signing now is that person", by: "didit", how: "Biometric Authentication: 5-second face re-check (US$0.10)" },
  { step: "Title copy is in the owner's name and unedited", by: "didit", how: "Document AI: reads fields, matches name, checks for edits (US$0.20)" },
  { step: "The agreement text, prefilled from verified data", by: "grid", how: "ATS template + listing + terms" },
  { step: "Consent to sign electronically + drawn signature", by: "grid", how: "Signing screen (RA 8792 e-signatures)" },
  { step: "Lock against changes", by: "grid", how: "SHA-256 fingerprint at sending; seal at completion" },
  { step: "Routing, status and audit trail", by: "grid", how: "Broker drafts → owner signs → broker countersigns" },
  { step: "Notarization", by: "third", how: "Notary public or SC-accredited electronic notary (A.M. No. 24-10-14-SC)" },
  { step: "Title is genuine at the registry", by: "third", how: "Certified True Copy from the Registry of Deeds" },
];

export const STATUS_LABEL: Record<DocStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-canvas text-muted border border-line" },
  awaiting_owner: { label: "Waiting for owner", cls: "bg-wait-soft text-wait" },
  awaiting_broker: { label: "Waiting for broker", cls: "bg-wait-soft text-wait" },
  completed: { label: "Completed", cls: "bg-ok-soft text-ok" },
  cancelled: { label: "Cancelled", cls: "bg-bad-soft text-bad" },
};
