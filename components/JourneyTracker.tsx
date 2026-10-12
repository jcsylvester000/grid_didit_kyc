import { Check } from "lucide-react";
import type { Journey } from "@/lib/server/journey";

const KYC_LABEL: Record<string, string> = {
  in_progress: "Started, not finished",
  retry: "Needs a retry",
  review: "Under manual review",
  pending: "Pending (service busy)",
  declined: "Declined, contact support",
};

/** Account created → Identity verified → First viewing booked. */
export function JourneyTracker({ journey, tone = "light" }: { journey: Journey; tone?: "light" | "dark" }) {
  const steps = [
    { label: "Account created", done: true, note: "No ID needed" },
    {
      label: "Identity verified",
      done: journey.verified,
      note: journey.verified ? "Reused for every viewing" : journey.kyc ? KYC_LABEL[journey.kyc] ?? "In progress" : "Only for Verified-only homes",
    },
    { label: "Viewing booked", done: journey.bookings > 0, note: journey.bookings > 0 ? `${journey.bookings} booked` : "Pick a home and a slot" },
  ];
  const dark = tone === "dark";
  return (
    <ol className="space-y-3" aria-label="Your progress">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-start gap-3">
          <span
            className={`grid place-items-center size-7 rounded-full shrink-0 text-xs font-semibold ${
              s.done ? "bg-ok text-white" : dark ? "border border-white/40 text-white/70" : "border border-iron text-muted"
            }`}
          >
            {s.done ? <Check size={14} aria-hidden /> : i + 1}
          </span>
          <span className="text-sm leading-tight">
            <span className={`block font-medium ${dark ? "text-white" : "text-midnight"}`}>
              {s.label}
              <span className="sr-only">{s.done ? " (done)" : " (not yet)"}</span>
            </span>
            <span className={dark ? "text-white/65 text-xs" : "text-muted text-xs"}>{s.note}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
