import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type TabDef = { key: string; label: string; count?: number };

/** Tab bar for the staff console. Server-rendered links (?tab=...), scrolls sideways on small screens. */
export function AdminTabs({ tabs, active }: { tabs: TabDef[]; active: string }) {
  return (
    <nav aria-label="Admin sections" className="border-b border-line overflow-x-auto">
      <ul className="flex gap-1 min-w-max">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.key === "overview" ? "/admin" : `/admin?tab=${t.key}`}
                aria-current={on ? "page" : undefined}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  on ? "border-nile text-nile font-semibold" : "border-transparent text-muted hover:text-nile hover:border-iron"
                }`}
              >
                {t.label}
                {t.count != null && t.count > 0 && (
                  <span className={`rounded-full text-[11px] px-1.5 py-0.5 tabular-nums ${on ? "bg-nile text-white" : "bg-canvas text-muted"}`}>{t.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** "Showing 31–60 of 245 · Page 2 of 9" with Newer / Older links. Max 30 rows per page. */
export function Pager({ tab, page, pages, from, to, total }: { tab: string; page: number; pages: number; from: number; to: number; total: number }) {
  const href = (p: number) => `/admin?tab=${tab}${p > 1 ? `&page=${p}` : ""}`;
  const btn = "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted">{total === 0 ? "No rows" : `Showing ${from}–${to} of ${total}`}{pages > 1 ? ` · Page ${page} of ${pages}` : ""}</p>
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={href(page - 1)} className={`${btn} border-iron hover:border-nile`} rel="prev"><ChevronLeft size={14} aria-hidden /> Newer</Link>
          ) : (
            <span className={`${btn} border-line text-iron`} aria-disabled="true"><ChevronLeft size={14} aria-hidden /> Newer</span>
          )}
          {page < pages ? (
            <Link href={href(page + 1)} className={`${btn} border-iron hover:border-nile`} rel="next">Older <ChevronRight size={14} aria-hidden /></Link>
          ) : (
            <span className={`${btn} border-line text-iron`} aria-disabled="true">Older <ChevronRight size={14} aria-hidden /></span>
          )}
        </nav>
      )}
    </div>
  );
}
