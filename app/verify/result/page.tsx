import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BadgeCheck, Clock, Eye, RotateCcw, XCircle, Loader2 } from "lucide-react";
import { getListing } from "@/lib/data";
import { currentUser } from "@/lib/server/session";
import { dbConfigured } from "@/lib/server/db";
import { getVerification, refreshFromDidit } from "@/lib/server/kyc";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DbMissing } from "@/components/ui";
import type { Outcome } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verification result" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

// Screen copy from the Walkthrough Guide §10.1 (draft — counsel to review before launch).
const COPY: Record<Outcome, { Icon: typeof Clock; tone: string; title: string; body: string }> = {
  verified: { Icon: BadgeCheck, tone: "bg-ok-soft text-ok", title: "You're verified", body: "No need to repeat this on Grid. You can now see the exact address and book a viewing." },
  retry: { Icon: RotateCcw, tone: "bg-wait-soft text-wait", title: "Let's try that again", body: "Your ID photo was a little blurry. It happens. Move to brighter light, hold steady and avoid glare." },
  review: { Icon: Eye, tone: "bg-info-soft text-info", title: "A person will review this", body: "We couldn't confirm everything automatically, so a Grid team member will check your ID. You won't be rejected because of a scan problem. We'll notify you by SMS and email." },
  pending: { Icon: Clock, tone: "bg-wait-soft text-wait", title: "Verification pending", body: "Our ID check service is busy right now. Your request is saved and we will finish it automatically. You can keep browsing in the meantime." },
  declined: { Icon: XCircle, tone: "bg-bad-soft text-bad", title: "We couldn't verify your identity", body: "Please contact our support team so we can help: support@grid.com.ph (sample contact)." },
  in_progress: { Icon: Loader2, tone: "bg-nile-soft text-nile", title: "Checking your ID…", body: "This usually takes a few seconds. You can leave this page; we'll keep your place." },
};

const RETRY_HINT: Record<string, string> = {
  not_finished: "It looks like the check was closed before it finished. Nothing was charged to you; you can start again any time.",
  id_expired: "Your ID appears to have expired. Please use a valid ID.",
  staff_requested_clearer_photo: "Our team asked for a clearer photo of your ID.",
};

export default async function ResultPage({ searchParams }: Props) {
  if (!dbConfigured()) return <DbMissing />;
  const sp = await searchParams;
  const user = await currentUser();
  let v = sp.v ? await getVerification(sp.v) : null;
  if (!v || v.user_id !== user.id) redirect("/account");
  v = await refreshFromDidit(v);

  const listing = getListing(v.listing_id);
  const c = COPY[v.outcome];
  const body = v.outcome === "retry" && v.failure_reason && RETRY_HINT[v.failure_reason] ? RETRY_HINT[v.failure_reason] : c.body;

  return (
    <div className="max-w-xl mx-auto">
      {v.outcome === "in_progress" && <AutoRefresh />}
      <div className="card p-6 sm:p-8 space-y-6 text-center">
        <div className={`mx-auto size-16 rounded-full grid place-items-center ${c.tone}`}>
          <c.Icon size={30} className={v.outcome === "in_progress" ? "animate-spin" : ""} aria-hidden />
        </div>
        <div>
          <h1 className="text-3xl text-nile">{c.title}</h1>
          <p className="mt-3 text-muted">{body}</p>
        </div>

        <div className="flex flex-col gap-3">
          {v.outcome === "verified" && listing && (
            <Link href={`/listings/${listing.id}`} className="btn btn-primary">See the address and book</Link>
          )}
          {v.outcome === "retry" && (
            <Link href={`/verify?listing=${listing?.id ?? ""}`} className="btn btn-primary">Try again</Link>
          )}
          {v.outcome === "pending" && (
            <Link href={`/verify?listing=${listing?.id ?? ""}`} className="btn btn-ghost">Try again now</Link>
          )}
          <Link href={listing ? `/listings/${listing.id}` : "/"} className="btn btn-ghost">
            {v.outcome === "verified" ? "Back to listings" : "Keep browsing"}
          </Link>
        </div>

        {v.didit_session_number && (
          <p className="text-xs text-muted">Reference: Didit session #{v.didit_session_number}</p>
        )}
      </div>
    </div>
  );
}
