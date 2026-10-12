import { BadgeCheck, Clock, Eye, RotateCcw, ShieldCheck, XCircle, Loader2 } from "lucide-react";
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

/** Illustrative card art (no stock photos: real unit photos come from listing owners). */
export function ListingArt({ tint, label }: { tint: string; label: string }) {
  return (
    <div className="relative aspect-[16/9] overflow-hidden" style={{ background: tint }} role="img" aria-label={label}>
      <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.10" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="400" height="225" fill="url(#sky)" />
        <circle cx="320" cy="60" r="26" fill="#e2b985" opacity="0.55" />
        <g fill="#ffffff" opacity="0.14">
          <rect x="18" y="95" width="46" height="130" />
          <rect x="72" y="50" width="58" height="175" />
          <rect x="140" y="110" width="38" height="115" />
          <rect x="188" y="30" width="66" height="195" />
          <rect x="262" y="80" width="44" height="145" />
          <rect x="314" y="120" width="70" height="105" />
        </g>
        <g fill="#e2b985" opacity="0.5">
          {[0, 1, 2, 3, 4].map((r) =>
            [0, 1, 2].map((c) => <rect key={`${r}-${c}`} x={200 + c * 18} y={50 + r * 26} width="9" height="12" />),
          )}
        </g>
        <path d="M0 205 C 80 190, 140 220, 220 205 S 340 190, 400 205 L400 225 L0 225Z" fill="#be8562" opacity="0.55" />
      </svg>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "ok" | "wait" | "bad"; children: React.ReactNode }) {
  const cls = { info: "bg-info-soft text-info", ok: "bg-ok-soft text-ok", wait: "bg-wait-soft text-wait", bad: "bg-bad-soft text-bad" }[tone];
  return <div className={`rounded-xl px-4 py-3 text-sm ${cls}`} role="status">{children}</div>;
}

export function DbMissing() {
  return (
    <div className="card p-6 max-w-xl">
      <h1 className="text-2xl">Database not configured</h1>
      <p className="mt-2 text-sm text-muted">
        Set <code>DATABASE_URL</code> (Neon) in <code>.env.local</code> or in Netlify environment variables, then restart.
      </p>
    </div>
  );
}
