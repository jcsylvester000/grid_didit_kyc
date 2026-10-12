import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/data";
import { currentUser } from "@/lib/server/session";
import { dbConfigured } from "@/lib/server/db";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/AuthForms";
import { DbMissing } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };
const safe = (p?: string) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "/");

export default async function LoginPage({ searchParams }: Props) {
  if (!dbConfigured()) return <DbMissing />;
  const next = safe((await searchParams).next);
  if (await currentUser()) redirect(next);
  const booking = next.startsWith("/verify") || next.startsWith("/listings");

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to GRID"
      intro={booking ? "Sign in to book this viewing. If the listing is Verified-only, we'll ask for a one-time ID check next." : "Pick up where you left off: saved homes, viewings and your verification status."}
      aside={
        <>
          <p className="font-medium">Internal demo accounts</p>
          <p className="text-white/75 mt-1">Password for all: <code className="text-burly">{DEMO_PASSWORD}</code></p>
          <ul className="mt-3 space-y-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.id} className="flex justify-between gap-3"><span>{a.email}</span><span className="text-white/65 text-xs text-right">{a.note}</span></li>
            ))}
          </ul>
        </>
      }
    >
      <LoginForm next={next} />
      <details className="lg:hidden mt-5 text-sm">
        <summary className="cursor-pointer text-nile">Internal demo accounts</summary>
        <p className="text-muted mt-2">Password for all: <code>{DEMO_PASSWORD}</code></p>
        <ul className="mt-2 space-y-1 text-muted">{DEMO_ACCOUNTS.map((a) => <li key={a.id}>{a.email} · {a.note}</li>)}</ul>
      </details>
    </AuthShell>
  );
}
