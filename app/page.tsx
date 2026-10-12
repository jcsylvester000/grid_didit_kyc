import Image from "next/image";
import Link from "next/link";
import { BedDouble, Bath, Ruler, MapPin, LockOpen, Timer, Repeat, ShieldCheck, IdCard, ScanFace, KeyRound, ArrowRight, PartyPopper } from "lucide-react";
import { LISTINGS, formatPhp } from "@/lib/data";
import { HERO_PHOTO, VERIFY_PHOTO, listingPhotos } from "@/lib/photos";
import { ListingPhoto, OwnerBadge, VerifiedBadge, AccessBadge } from "@/components/ui";
import { JourneyTracker } from "@/components/JourneyTracker";
import { journeyFor } from "@/lib/server/journey";
import { currentUser } from "@/lib/server/session";
import { dbConfigured } from "@/lib/server/db";
import { findReusable } from "@/lib/server/kyc";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const CITIES = ["All", "Metro Manila", "Cebu"] as const;
const ACCESS = [
  { key: "all", label: "All homes" },
  { key: "open", label: "Open listings" },
  { key: "verified", label: "Verified-only" },
] as const;

function filterHref(city: string, access: string) {
  const p = new URLSearchParams();
  if (city !== "All") p.set("city", city);
  if (access !== "all") p.set("access", access);
  const q = p.toString();
  return `/${q ? `?${q}` : ""}#listings`;
}

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  const city = CITIES.includes(sp.city as (typeof CITIES)[number]) ? sp.city! : "All";
  const access = ACCESS.some((a) => a.key === sp.access) ? sp.access! : "all";
  const user = await currentUser();
  const verified = user && dbConfigured() ? await findReusable(user.id).catch(() => null) : null;
  const journey = user && dbConfigured() ? await journeyFor(user.id).catch(() => null) : null;
  const listings = LISTINGS.filter((l) => (city === "All" || l.city === city) && (access === "all" || (access === "open" ? !l.requiresKyc : l.requiresKyc)));

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-midnight text-white">
        <Image src={HERO_PHOTO.src} alt={HERO_PHOTO.alt} fill priority sizes="100vw" className="object-cover -z-20" />
        <div className="absolute inset-0 hero-scrim -z-10" />
        <div className="page grid lg:grid-cols-[1.4fr_1fr] gap-10 items-center py-16 sm:py-24">
          <div>
            <p className="font-serif italic text-burly text-lg">GRID Verified rentals</p>
            <h1 className="text-4xl sm:text-6xl leading-[1.05] mt-2">Rent from owners who are who they say they are.</h1>
            <p className="mt-5 text-white/80 text-lg max-w-xl">
              Browse freely. A one-minute ID check happens only when you book your first viewing, so owners know who is coming
              and you know the listing is authorized.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#listings" className="btn bg-white text-midnight hover:bg-burly">Browse listings <ArrowRight size={16} aria-hidden /></a>
              <a href="#how" className="btn border border-white/40 text-white hover:border-burly hover:text-burly">How verification works</a>
            </div>
          </div>
          <div className="glass rounded-[18px] p-5 text-sm space-y-4">
            {user ? (
              <>
                {sp.welcome && (
                  <p className="flex items-center gap-2 text-burly font-medium"><PartyPopper size={16} aria-hidden /> Welcome to GRID, {user.name.split(" ")[0]}!</p>
                )}
                <div>
                  <p className="text-white/60 text-xs uppercase tracking-wider">Signed in</p>
                  <p className="text-xl font-display">{user.name}</p>
                </div>
                {journey && <JourneyTracker journey={journey} tone="dark" />}
                {verified ? (
                  <p className="flex items-center gap-2"><VerifiedBadge /> <span className="text-white/80">All addresses unlocked.</span></p>
                ) : (
                  <p className="text-white/80">Open listings are ready to book. Verified-only homes ask for a one-time ID check.</p>
                )}
              </>
            ) : (
              <>
                <p className="text-xl font-display">Find your next home</p>
                <p className="text-white/80">Browse every listing without an account. Create a free account to book viewings. No ID needed to sign up.</p>
                <div className="flex flex-wrap gap-2">
                  <a href="/register" className="btn bg-white text-midnight hover:bg-burly">Create account</a>
                  <a href="/login" className="btn border border-white/40 hover:border-burly hover:text-burly">Sign in</a>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="border-t border-white/10 bg-midnight/60 backdrop-blur">
          <ul className="page !py-5 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {[
              { Icon: Timer, t: "About 1 minute", d: "ID photo + selfie, once" },
              { Icon: LockOpen, t: "Open listings", d: "Full details, book with an account" },
              { Icon: ShieldCheck, t: "Photos stay with Didit", d: "Grid keeps only the result" },
              { Icon: IdCard, t: "PhilID accepted", d: "Plus passport, license, UMID" },
            ].map(({ Icon, t, d }) => (
              <li key={t} className="flex items-start gap-3">
                <Icon size={20} className="text-burly shrink-0 mt-0.5" aria-hidden />
                <span><b className="block font-medium">{t}</b><span className="text-white/65">{d}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Listings */}
      <section id="listings" aria-labelledby="listings-h" className="page scroll-mt-20 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="eyebrow">Available now</p>
            <h2 id="listings-h" className="text-3xl text-nile">{listings.length} {listings.length === 1 ? "home" : "homes"} ready for viewing</h2>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <nav aria-label="Filter by access" className="flex flex-wrap gap-2">
              {ACCESS.map((a) => (
                <Link key={a.key} href={filterHref(city, a.key)} aria-current={access === a.key ? "page" : undefined}
                  className={`rounded-full px-4 py-2 text-sm border transition-colors ${access === a.key ? "bg-nile text-white border-nile" : "bg-white border-iron hover:border-nile"}`}>
                  {a.label}
                </Link>
              ))}
            </nav>
            <nav aria-label="Filter by city" className="flex flex-wrap gap-2">
              {CITIES.map((c) => (
                <Link key={c} href={filterHref(c, access)} aria-current={city === c ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${city === c ? "bg-muesli-soft text-muesli-text border-muesli" : "bg-white border-iron hover:border-nile"}`}>
                  {c}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        {listings.length === 0 && <p className="text-muted">No homes match these filters.</p>}
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((l, i) => (
            <li key={l.id}>
              <Link href={`/listings/${l.id}`} className="group card block overflow-hidden hover:-translate-y-0.5 hover:shadow-xl transition-all">
                <div className="relative">
                  <ListingPhoto photo={listingPhotos(l.id)[0]} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" priority={i < 3} scrim className="aspect-[4/3] [&_img]:group-hover:scale-105 [&_img]:transition-transform [&_img]:duration-500" />
                  <div className="absolute top-3 left-3 flex flex-wrap gap-2">{l.ownerAuthorized && <OwnerBadge />}</div>
                  <span className="absolute top-3 right-3"><AccessBadge requiresKyc={l.requiresKyc} unlocked={Boolean(verified)} /></span>
                  <p className="absolute bottom-3 left-4 text-white text-2xl font-semibold drop-shadow">
                    {formatPhp(l.rentPhp)}<span className="text-sm font-normal text-white/80">/mo</span>
                  </p>
                </div>
                <div className="p-4 space-y-2">
                  <p className="font-medium leading-snug group-hover:text-nile">{l.title}</p>
                  <p className="text-sm text-muted flex items-center gap-1"><MapPin size={14} aria-hidden /> {l.area}</p>
                  <p className="text-xs text-muted flex items-center gap-4 pt-1">
                    <span className="flex items-center gap-1"><BedDouble size={14} aria-hidden /> {l.beds ? `${l.beds} bed` : "Studio"}</span>
                    <span className="flex items-center gap-1"><Bath size={14} aria-hidden /> {l.baths} bath</span>
                    <span className="flex items-center gap-1"><Ruler size={14} aria-hidden /> {l.sqm} sqm</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section id="how" aria-labelledby="how-h" className="bg-white border-y border-line scroll-mt-20">
        <div className="page py-16 grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative aspect-[4/3] rounded-[22px] overflow-hidden shadow-xl">
            <Image src={VERIFY_PHOTO.src} alt={VERIFY_PHOTO.alt} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
            <div className="absolute bottom-4 left-4 right-4 glass rounded-xl p-4 text-white text-sm">
              <p className="font-medium">Didit secure check</p>
              <p className="text-white/75">Opens from Grid. Your ID photo and selfie never touch Grid&apos;s servers.</p>
            </div>
          </div>
          <div>
            <p className="eyebrow">How GRID Verified works</p>
            <h2 id="how-h" className="text-3xl text-nile">Checked once, at the moment it matters</h2>
            <ol className="mt-8 space-y-6">
              {[
                { Icon: KeyRound, t: "Create an account, then book", d: "Sign-up needs only your name and email. Open listings book straight away; Verified-only homes ask for ID at that moment." },
                { Icon: ScanFace, t: "Photo of your ID, then a selfie", d: "Didit confirms the ID is genuine, that you are a live person, and that your face matches the ID." },
                { Icon: Repeat, t: "Verified for every viewing", d: "Next time, the address unlocks instantly. Signing a lease later needs only a 5-second face check." },
              ].map(({ Icon, t, d }, i) => (
                <li key={t} className="flex gap-4">
                  <span className="grid place-items-center size-11 rounded-full bg-nile text-white shrink-0 font-display text-lg">{i + 1}</span>
                  <div>
                    <p className="font-medium flex items-center gap-2"><Icon size={16} className="text-muesli" aria-hidden /> {t}</p>
                    <p className="text-sm text-muted mt-1">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
