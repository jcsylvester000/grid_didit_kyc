import Image from "next/image";
import { SKYLINE_PHOTO } from "@/lib/photos";

/** Two-column auth layout: form on the left, photo with key points on the right. */
export function AuthShell({ eyebrow, title, intro, children, aside }: { eyebrow: string; title: string; intro: string; children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="page grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
      <div className="min-w-0 max-w-md w-full mx-auto lg:mx-0 space-y-6">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="text-3xl sm:text-4xl text-nile mt-1">{title}</h1>
          <p className="text-muted mt-2">{intro}</p>
        </div>
        <div className="card p-6">{children}</div>
      </div>
      <aside className="hidden lg:block relative aspect-[4/5] rounded-[22px] overflow-hidden shadow-xl">
        <Image src={SKYLINE_PHOTO.src} alt={SKYLINE_PHOTO.alt} fill sizes="45vw" className="object-cover" />
        <div className="absolute inset-0 photo-scrim" />
        <div className="absolute bottom-5 left-5 right-5 glass rounded-xl p-5 text-white text-sm">{aside}</div>
      </aside>
    </div>
  );
}
