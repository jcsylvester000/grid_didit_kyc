import Image from "next/image";
import Link from "next/link";
import { DEMO_USERS } from "@/lib/data";
import { currentUser } from "@/lib/server/session";
import { isMockMode } from "@/lib/server/env";
import { UserSwitcher } from "./UserSwitcher";

export async function SiteHeader() {
  const user = await currentUser();
  const mock = isMockMode();
  return (
    <header>
      {mock && (
        <div className="bg-wait-soft text-wait text-xs text-center px-4 py-1.5">
          Mock mode: no Didit API key set, so the Didit screen is simulated. Add keys in <code>.env.local</code> to go live.
        </div>
      )}
      <div className="bg-midnight text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
          <Link href="/" className="shrink-0" aria-label="GRID Property Ventures home">
            <Image src="/brand/grid-logo-dark.png" alt="GRID Property Ventures" width={150} height={39} priority />
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-white/85" aria-label="Main">
            <Link href="/" className="hover:text-burly">Listings</Link>
            <Link href="/account" className="hover:text-burly">My verification</Link>
            <Link href="/admin" className="hover:text-burly">Admin</Link>
          </nav>
          <div className="ml-auto">
            <UserSwitcher users={DEMO_USERS.map((u) => ({ id: u.id, label: `${u.name} · ${u.note}` }))} current={user.id} />
          </div>
        </div>
      </div>
      <div className="brand-rule" />
      <nav className="md:hidden bg-white border-b border-line text-sm flex justify-around py-2" aria-label="Main mobile">
        <Link href="/">Listings</Link>
        <Link href="/account">My verification</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </header>
  );
}
