import Image from "next/image";
import type { Photo } from "@/lib/photos";
import { BadgeCheck, Clock, Eye, RotateCcw, ShieldCheck, XCircle, Loader2, Lock, LockOpen } from "lucide-react";
import type { Outcome } from "@/lib/types";

export function VerifiedBadge({ label = "Verified Identity" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft text-ok text-xs font-medium px-2.5 py-1">
      <BadgeCheck size={14} aria-hidden /> {label}
    </span>
  );
}

/** "Owner identity matched to title copy" — never "Title verified" (Readiness Report §5.4). */
export function OwnerBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-muesli-soft text-muesli-text text-xs font-medium px-2.5 py-1"
      title="The verified owner's name matches the title copy they uploaded. Grid does not confirm titles with the Registry of Deeds."
    >
      <ShieldCheck size={14} aria-hidden /> Owner-Authorized
    </span>
  );
}

/** Listing access: Open (any signed-in user) vs Verified-only (passed ID check). */
export function AccessBadge({ requiresKyc, unlocked = false }: { requiresKyc: boolean; unlocked?: boolean }) {
  if (!requiresKyc)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/95 text-ok text-xs font-medium px-2.5 py-1">
        <LockOpen size={12} aria-hidden /> Open listing
      </span>
    );
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-xs font-medium px-2.5 py-1 ${unlocked ? "bg-ok-soft text-ok" : "bg-midnight/80 text-white"}`}>
      {unlocked ? <BadgeCheck size={12} aria-hidden /> : <Lock size={12} aria-hidden />} Verified-only{unlocked ? " · unlocked" : ""}
    </span>
  );
}

const OUTCOME_STYLE: Record<Outcome, { label: string; cls: string; Icon: typeof Clock }> = {
  verified: { label: "Verified", cls: "bg-ok-soft text-ok", Icon: BadgeCheck },
  retry: { label: "Retry needed", cls: "bg-wait-soft text-wait", Icon: RotateCcw },
  review: { label: "Manual review", cls: "bg-info-soft text-info", Icon: Eye },
  pending: { label: "Pending", cls: "bg-wait-soft text-wait", Icon: Clock },
  declined: { label: "Declined", cls: "bg-bad-soft text-bad", Icon: XCircle },
  in_progress: { label: "In progress", cls: "bg-nile-soft text-nile", Icon: Loader2 },
};

export function OutcomeChip({ outcome }: { outcome: Outcome }) {
  const s = OUTCOME_STYLE[outcome] ?? OUTCOME_STYLE.in_progress;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full text-xs font-medium px-2.5 py-1 ${s.cls}`}>
      <s.Icon size={13} aria-hidden /> {s.label}
    </span>
  );
}

/** Listing photo (Unsplash sample) with an optional dark scrim for overlaid text. */
export function ListingPhoto({ photo, sizes, priority = false, scrim = false, className = "" }: { photo: Photo; sizes: string; priority?: boolean; scrim?: boolean; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-nile-soft ${className}`}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      {scrim && <div className="absolute inset-0 photo-scrim" />}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "ok" | "wait" | "bad"; children: React.ReactNode }) {
  const cls = { info: "bg-info-soft text-info", ok: "bg-ok-soft text-ok", wait: "bg-wait-soft text-wait", bad: "bg-bad-soft text-bad" }[tone];
  return <div className={`rounded-xl px-4 py-3 text-sm ${cls}`} role="status">{children}</div>;
}

export function DbMissing() {
  return (
    <div className="page"><div className="card p-6 max-w-xl">
      <h1 className="text-2xl">Database not configured</h1>
      <p className="mt-2 text-sm text-muted">
        Set <code>DATABASE_URL</code> (Neon) in <code>.env.local</code> or in Netlify environment variables, then restart.
      </p>
    </div></div>
  );
}
