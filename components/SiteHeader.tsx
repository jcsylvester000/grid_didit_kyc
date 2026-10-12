import Image from "next/image";
import Link from "next/link";
import { DEMO_USERS } from "@/lib/data";
import { currentUser } from "@/lib/server/session";
import { isMockMode } from "@/lib/server/env";
import { UserSwitcher } from "./UserSwitcher";
import { LockKeyhole } from "lucide-react";
import { lockAction } from "@/app/actions";

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-6">
          <Link href="/" className="shrink-0" aria-label="GRID Property Ventures home">
            <Image src="/brand/grid-logo-dark.png" alt="GRID Property Ventures" width={150} height={39} priority className="w-[104px] sm:w-[150px] h-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-white/85" aria-label="Main">
            <Link href="/" className="hover:text-burly">Listings</Link>
            <Link href="/account" className="hover:text-burly">My verification</Link>
            <Link href="/admin" className="hover:text-burly">Admin</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2 min-w-0">
            <UserSwitcher users={DEMO_USERS.map((u) => ({ id: u.id, label: `${u.name} · ${u.note}` }))} current={user.id} />
            <form action={lockAction}>
              <button className="grid place-items-center size-10 rounded-full border border-white/20 text-white/80 hover:text-burly hover:border-burly" aria-label="Lock the app" title="Lock">
                <LockKeyhole size={16} aria-hidden />
              </button>
            </form>
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
