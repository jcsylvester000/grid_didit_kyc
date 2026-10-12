import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, LogOut } from "lucide-react";
import { currentUser } from "@/lib/server/session";
import { isMockMode } from "@/lib/server/env";
import { lockAction, logoutAction } from "@/app/actions";

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

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
            {user && <Link href="/account" className="hover:text-burly">My account</Link>}
            <Link href="/admin" className="hover:text-burly">Admin</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2 min-w-0">
            {user ? (
              <>
                <Link href="/account" className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-white/10 min-w-0" title="My account">
                  <span className="grid place-items-center size-8 rounded-full bg-muesli text-midnight text-xs font-semibold shrink-0" aria-hidden>{initials(user.name)}</span>
                  <span className="text-sm truncate max-w-[7rem] sm:max-w-[12rem]">{user.name.split(" ")[0]}</span>
                </Link>
                <form action={logoutAction}>
                  <button className="grid place-items-center size-10 rounded-full border border-white/20 text-white/80 hover:text-burly hover:border-burly" aria-label="Sign out" title="Sign out">
                    <LogOut size={16} aria-hidden />
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm px-2 sm:px-3 py-2 hover:text-burly whitespace-nowrap">Sign in</Link>
                <Link href="/register" className="btn bg-white text-midnight hover:bg-burly !min-h-9 !px-3 sm:!px-4 text-sm whitespace-nowrap">Register</Link>
              </>
            )}
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
        {user && <Link href="/account">My account</Link>}
        <Link href="/admin">Admin</Link>
      </nav>
    </header>
  );
}
