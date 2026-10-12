import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ATS_SUGGESTED_PRICE, LISTINGS } from "@/lib/data";
import { requireUser } from "@/lib/server/session";
import { findReusable } from "@/lib/server/kyc";
import { NewAtsForm } from "@/components/DocForms";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New Authority to Sell" };

export default async function NewAtsPage() {
  const user = await requireUser("/documents/new");
  if (user.role !== "broker") {
    return (
      <div className="page max-w-xl space-y-4">
        <Notice tone="info">Only broker accounts can draft an Authority to Sell. Sign in as <b>liza@example.com</b> (demo broker) to try it.</Notice>
        <Link href="/documents" className="btn btn-ghost">Back to documents</Link>
      </div>
    );
  }
  if (!(await findReusable(user.id))) redirect("/documents");
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  return (
    <div className="page max-w-2xl space-y-6">
      <Link href="/documents" className="text-sm text-muted hover:text-nile">← Documents</Link>
      <div>
        <p className="eyebrow">Step 1 · Broker</p>
        <h1 className="text-3xl text-nile">Draft an Authority to Sell</h1>
        <p className="text-muted mt-2">Names come from each person&apos;s verified identity, so nobody types them by hand. You can review the draft before sending it.</p>
      </div>
      <div className="card p-6">
        <NewAtsForm
          listings={LISTINGS.map((l) => ({ id: l.id, label: `${l.title} · ${l.area}` }))}
          suggested={ATS_SUGGESTED_PRICE}
          defaultOwnerEmail="ramon@example.com"
          today={today}
        />
      </div>
    </div>
  );
}
