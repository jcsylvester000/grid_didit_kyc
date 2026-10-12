import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { UserPlus, Search, ScanFace } from "lucide-react";
import { currentUser } from "@/lib/server/session";
import { dbConfigured } from "@/lib/server/db";
import { AuthShell } from "@/components/AuthShell";
import { RegisterForm } from "@/components/AuthForms";
import { DbMissing } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create account" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };
const safe = (p?: string) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "/");

export default async function RegisterPage({ searchParams }: Props) {
  if (!dbConfigured()) return <DbMissing />;
  const next = safe((await searchParams).next);
  if (await currentUser()) redirect(next);

  return (
    <AuthShell
      eyebrow="Create your account"
      title="Join GRID in under a minute"
      intro="No ID needed to sign up. We only ask for a one-time ID check when you book a Verified-only home."
      aside={
        <ol className="space-y-3">
          <li className="flex gap-3"><UserPlus size={18} className="text-burly shrink-0" aria-hidden /><span><b className="font-medium">1. Create your account</b><br /><span className="text-white/75">Name, email and password. No ID.</span></span></li>
          <li className="flex gap-3"><Search size={18} className="text-burly shrink-0" aria-hidden /><span><b className="font-medium">2. Browse and book</b><br /><span className="text-white/75">Open listings show everything and book straight away.</span></span></li>
          <li className="flex gap-3"><ScanFace size={18} className="text-burly shrink-0" aria-hidden /><span><b className="font-medium">3. Verify once for Verified-only homes</b><br /><span className="text-white/75">ID photo + selfie with Didit, reused for every future viewing.</span></span></li>
        </ol>
      }
    >
      <RegisterForm next={next} />
    </AuthShell>
  );
}
