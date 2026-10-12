import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { getListing, idTypeLabel, isDemoAccount, PRICING } from "@/lib/data";
import { STATUS_LABEL } from "@/components/DiditGridLegend";
import Link from "next/link";
import { isAdmin } from "@/lib/server/session";
import { dbConfigured, q } from "@/lib/server/db";
import { auditPage, documentsPage, usersPage, verificationsPage, webhooksPage } from "@/lib/server/admin";
import { AdminTabs, Pager, type TabDef } from "@/components/AdminPaging";
import { env, isMockMode } from "@/lib/server/env";
import { adminSnapshot } from "@/lib/server/kyc";
import { DbMissing, Notice, OutcomeChip } from "@/components/ui";
import { adminDecideAction, adminDeleteAccountsAction, adminLoginAction, adminLogoutAction, adminResetDemoAction, adminToggleOutageAction } from "@/app/actions";
import type { Outcome } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-PH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Manila" }) : "—");

const TAB_KEYS = ["overview", "review", "accounts", "documents", "verifications", "webhooks", "audit"] as const;
type Tab = (typeof TAB_KEYS)[number];

const REASON: Record<string, string> = {
  didit_in_review: "Didit flagged for review",
  philid_scan_protected: "PhilID could not be read — routed to a person (PhilSys Act)",
  simulated_outage: "Didit outage (simulated)",
  network: "Didit unreachable",
  didit_down: "Didit server error",
  rate_limited: "Didit rate limit",
  no_credit: "Didit credit balance too low",
  config_error: "Configuration error (check API key / workflow ID)",
};

export default async function AdminPage({ searchParams }: Props) {
  const sp = await searchParams;
  if (!(await isAdmin())) {
    return (
      <div className="page"><div className="max-w-sm mx-auto card p-6 space-y-4">
        <h1 className="text-2xl text-nile">Grid staff console</h1>
        {!env.adminCode() && <Notice tone="bad">ADMIN_ACCESS_CODE is not set. Add it in Netlify environment variables.</Notice>}
        {sp.error && <Notice tone="bad">That code didn&apos;t work.</Notice>}
        <form action={adminLoginAction} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="code">Access code</label>
          <input id="code" name="code" type="password" className="input" autoComplete="current-password" required />
          <button className="btn btn-primary w-full" type="submit">Open console</button>
        </form>
        {process.env.NODE_ENV !== "production" && !process.env.ADMIN_ACCESS_CODE && (
          <p className="text-xs text-muted">Local dev default: <code>grid-admin-dev</code></p>
        )}
      </div></div>
    );
  }
  if (!dbConfigured()) return <DbMissing />;

  const tab: Tab = (TAB_KEYS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";
  const pageNo = Number(sp.page) || 1;
  const s = await adminSnapshot();
  const queueIds = [...s.review, ...s.pending].map((v) => v.user_id);
  const nameRows = queueIds.length ? await q<{ id: string; name: string }>(`SELECT id, display_name AS name FROM kyc_users WHERE id = ANY($1)`, [queueIds]) : [];
  const names = new Map(nameRows.map((u) => [u.id, u.name]));
  const who = (id: string | null) => (id ? names.get(id) ?? "Deleted account" : "—");
  const mock = isMockMode();
  const used = mock ? s.completedMock : s.completedLive;
  const pct = Math.min(100, Math.round((used / PRICING.freePerFeature) * 100));
  const over = Math.max(0, used - PRICING.freePerFeature);
  const overUsd = over * PRICING.features.reduce((a, f) => a + f.usd, 0);
  const kpis: { label: string; outcome: Outcome }[] = [
    { label: "Verified", outcome: "verified" },
    { label: "In review", outcome: "review" },
    { label: "Pending", outcome: "pending" },
    { label: "Retry", outcome: "retry" },
    { label: "Declined", outcome: "declined" },
  ];
  const tabs: TabDef[] = [
    { key: "overview", label: "Overview" },
    { key: "review", label: "Review queue", count: s.review.length },
    { key: "accounts", label: "Accounts" },
    { key: "documents", label: "Documents" },
    { key: "verifications", label: "Verifications" },
    { key: "webhooks", label: "Webhooks" },
    { key: "audit", label: "Audit log" },
  ];

  // Each tab loads only its own table (30 rows per page).
  const [users, docs, verifs, hooks, audit] = await Promise.all([
    tab === "accounts" ? usersPage(pageNo) : null,
    tab === "documents" ? documentsPage(pageNo) : null,
    tab === "verifications" ? verificationsPage(pageNo) : null,
    tab === "webhooks" ? webhooksPage(pageNo) : null,
    tab === "audit" ? auditPage(pageNo) : null,
  ]);

  return (
    <div className="page space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Staff console</p>
          <h1 className="text-3xl text-nile">GRID Verified operations</h1>
        </div>
        <form action={adminLogoutAction}><button className="btn btn-ghost">Sign out</button></form>
      </div>
      {sp.reset && <Notice tone="ok">Demo data reset. Paolo&apos;s sample verification was re-created.</Notice>}
      {sp.accounts && <Notice tone="ok">Registered test accounts deleted. Demo accounts were kept.</Notice>}


      <AdminTabs tabs={tabs} active={tab} />

      {tab === "overview" && (
        <div className="space-y-8">
      {/* Configuration */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 space-y-2 text-sm">
          <h2 className="text-lg text-nile">Didit connection</h2>
          <p className="flex items-center gap-2">
            {mock ? <AlertTriangle size={16} className="text-wait" aria-hidden /> : <CheckCircle2 size={16} className="text-ok" aria-hidden />}
            {mock ? "Mock mode (no API key)" : "Live API key set"}
          </p>
          <p className="text-muted">Workflow ID: {env.diditWorkflowId() ? "set" : "missing"}</p>
          <p className="text-muted">Biometric workflow (signing): {env.diditBiometricWorkflowId() ? "set" : "missing"}</p>
          <p className="text-muted">Webhook secret: {env.diditWebhookSecret() ? "set" : "missing"}</p>
          <p className="text-muted break-all">Webhook URL for Didit console: <code>{env.appUrl()}/api/didit/webhook</code></p>
        </div>
        <div className="card p-5 space-y-3 text-sm">
          <h2 className="text-lg text-nile">Simulate a Didit outage</h2>
          <p className="text-muted">Shows the &quot;Verification pending&quot; fallback. Only the protected step waits; browsing keeps working.</p>
          <form action={adminToggleOutageAction}>
            <input type="hidden" name="on" value={s.outage ? "0" : "1"} />
            <button className={`btn ${s.outage ? "btn-danger" : "btn-ghost"}`}>{s.outage ? "Outage ON — turn off" : "Turn outage on"}</button>
          </form>
        </div>
        <div className="card p-5 space-y-3 text-sm">
          <h2 className="text-lg text-nile">Demo data</h2>
          <p className="text-muted">Reset clears verifications, consents, bookings and webhook events (accounts kept). The audit log is append-only.</p>
          <div className="flex flex-wrap gap-2">
            <form action={adminResetDemoAction}><button className="btn btn-ghost">Reset demo data</button></form>
            <form action={adminDeleteAccountsAction}><button className="btn btn-ghost">Delete registered accounts</button></form>
          </div>
        </div>
      </section>

      {/* Free tier */}
      <section className="card p-5 space-y-4" aria-labelledby="jar-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="jar-h" className="text-lg text-nile">Free checks this month {mock && <span className="text-sm text-muted">(simulated sessions)</span>}</h2>
          <p className="text-sm text-muted">{PRICING.freePerFeature} free per feature per month · alert at {PRICING.alertAt} · {s.reused} checks saved by reuse</p>
        </div>
        {used >= PRICING.alertAt && (
          <Notice tone="wait">{used} of {PRICING.freePerFeature} free checks used. Paid usage starts at {PRICING.freePerFeature + 1}. Confirm auto top-up and backup card.</Notice>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRICING.features.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <div className="flex justify-between text-sm"><span>{f.label}</span><span className="tabular-nums text-muted">{used} / {PRICING.freePerFeature}</span></div>
              <div className="h-2 rounded-full bg-canvas overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={PRICING.freePerFeature} aria-valuenow={used} aria-label={`${f.label} free checks used`}>
                <div className={`h-full rounded-full ${used >= PRICING.alertAt ? "bg-wait" : "bg-nile"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted">then US${f.usd.toFixed(2)} each</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">
          Counts sessions that reached Approved, Declined, In Review or Resubmitted (Didit bills a feature when it completes). Est. paid usage this month:
          US${overUsd.toFixed(2)} (≈₱{Math.round(overUsd * PRICING.usdToPhp).toLocaleString("en-PH")}). Prices: Didit list, 2 Oct 2026. Always-paid add-ons
          (face re-check, AML, proof of address) are not included.
        </p>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div key={k.outcome} className="card p-4">
            <OutcomeChip outcome={k.outcome} />
            <p className="text-3xl font-semibold mt-2 tabular-nums">{s.byOutcome[k.outcome] ?? 0}</p>
            <p className="text-xs text-muted">{k.label} this month</p>
          </div>
        ))}
      </section>

          {s.review.length > 0 && (
            <Notice tone="info">{s.review.length} verification{s.review.length === 1 ? "" : "s"} waiting for manual review. <Link className="underline font-medium" href="/admin?tab=review">Open the review queue</Link></Notice>
          )}
      {/* Pending */}
      <section className="space-y-3">
        <h2 className="text-xl text-nile">Pending: Didit was unavailable ({s.pending.length})</h2>
        {s.pending.length === 0 ? (
          <p className="text-sm text-muted">Nothing pending.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-tight w-full">
              <thead><tr><th>User</th><th>Reason</th><th>Listing</th><th>Since</th></tr></thead>
              <tbody>
                {s.pending.map((v) => (
                  <tr key={v.id}><td>{who(v.user_id)}</td><td>{REASON[v.failure_reason ?? ""] ?? v.failure_reason}</td><td>{getListing(v.listing_id)?.title ?? "—"}</td><td>{fmt(v.updated_at)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted px-3 py-2">Users resume from the listing or their account page. Production: notify them by SMS/email when Didit is back.</p>
          </div>
        )}
      </section>

        </div>
      )}

      {tab === "review" && (
        <div className="space-y-3">
      {/* Review queue */}
      <section id="review" className="space-y-3">
        <h2 className="text-xl text-nile">Manual review queue ({s.review.length})</h2>
        {s.review.length === 0 && <p className="text-sm text-muted">Nothing waiting.</p>}
        {s.review.map((v) => (
          <article key={v.id} className="card p-5 grid lg:grid-cols-[1fr_1.2fr] gap-5">
            <div className="space-y-1 text-sm">
              <p className="font-medium text-base">{who(v.user_id)}</p>
              <p className="text-muted">{idTypeLabel(v.id_type_chosen)} · {getListing(v.listing_id)?.title ?? "—"}</p>
              <p className="text-muted">{REASON[v.failure_reason ?? ""] ?? v.failure_reason ?? "—"}</p>
              <p className="text-muted">Didit: {v.didit_status ?? "—"} · session {v.didit_session_number ? `#${v.didit_session_number}` : v.didit_session_id?.slice(0, 13) ?? "—"}</p>
              <p className="text-muted">Waiting since {fmt(v.updated_at)}</p>
              <details className="pt-2">
                <summary className="cursor-pointer text-nile">Review checklist</summary>
                <ol className="list-decimal pl-5 mt-2 space-y-1 text-muted">
                  <li>Open the session in the Didit console using the session number.</li>
                  <li>ID photo readable, unexpired, no signs of editing.</li>
                  <li>Selfie matches the ID photo.</li>
                  <li>Name on ID matches the Grid account.</li>
                  <li>PhilID unreadable but genuine → approve or ask for a clearer photo. Never reject for a scan problem alone.</li>
                  <li>Record the decision and a short reason.</li>
                  <li>Never ask for ID photos by email, chat or social media.</li>
                </ol>
              </details>
            </div>
            <form action={adminDecideAction} className="space-y-3">
              <input type="hidden" name="id" value={v.id} />
              <label className="block text-sm font-medium" htmlFor={`note-${v.id}`}>Reason (required)</label>
              <textarea id={`note-${v.id}`} name="note" className="input min-h-20" required maxLength={500} placeholder="e.g. PhilID genuine, glare on PCN area; selfie matches" />
              <div className="flex flex-wrap gap-2">
                <button name="action" value="approve" className="btn btn-primary">Approve</button>
                <button name="action" value="request_retry" className="btn btn-ghost">Ask for clearer photo</button>
                <button name="action" value="decline" className="btn btn-danger">Decline</button>
              </div>
              <p className="text-xs text-muted">Also record the decision in the Didit console so both systems agree.</p>
            </form>
          </article>
        ))}
      </section>

        </div>
      )}

      {tab === "accounts" && users && (
        <section className="space-y-3" aria-labelledby="users-h">
          <h2 id="users-h" className="text-xl text-nile">Accounts</h2>
          <Pager tab="accounts" {...users} />
          <div className="card overflow-x-auto">
            <table className="table-tight w-full">
              <thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Role</th><th>Identity</th><th>Viewings</th><th>Documents</th><th>Joined</th><th>Last sign-in</th></tr></thead>
              <tbody>
                {users.rows.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.name}</td>
                    <td>{u.email}</td>
                    <td>{isDemoAccount(u.id) ? "Demo" : "Registered"}</td>
                    <td className="capitalize">{u.role}</td>
                    <td>{u.kyc_outcome ? <OutcomeChip outcome={u.kyc_outcome as Outcome} /> : <span className="text-muted">Not started</span>}</td>
                    <td className="tabular-nums">{u.bookings}</td>
                    <td className="tabular-nums">{u.documents}</td>
                    <td className="whitespace-nowrap">{fmt(u.created_at)}</td>
                    <td className="whitespace-nowrap">{fmt(u.last_login_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager tab="accounts" {...users} />
        </section>
      )}

      {tab === "documents" && docs && (
        <section className="space-y-3" aria-labelledby="docs-h">
          <h2 id="docs-h" className="text-xl text-nile">Document transactions</h2>
          <Pager tab="documents" {...docs} />
          <div className="card overflow-x-auto">
            <table className="table-tight w-full">
              <thead><tr><th>Updated</th><th>Document</th><th>Property</th><th>Owner</th><th>Broker</th><th>Status</th><th>Title check</th></tr></thead>
              <tbody>
                {docs.rows.length === 0 && <tr><td colSpan={7} className="text-muted">No documents yet.</td></tr>}
                {docs.rows.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap">{fmt(d.updated_at)}</td>
                    <td><Link className="underline" href={`/documents/${d.id}`}>ATS {d.id.slice(0, 8).toUpperCase()}</Link></td>
                    <td>{getListing(d.listing_id)?.title ?? d.listing_id}</td>
                    <td>{d.owner_name}</td>
                    <td>{d.broker_name}</td>
                    <td><span className={`rounded-full text-xs px-2 py-0.5 ${STATUS_LABEL[d.status].cls}`}>{STATUS_LABEL[d.status].label}</span></td>
                    <td>{d.title_check ? `${d.title_check.status}${d.title_check.mode === "simulated" ? " (sim)" : ""}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager tab="documents" {...docs} />
        </section>
      )}

      {tab === "verifications" && verifs && (
        <section className="space-y-3" aria-labelledby="ver-h">
          <h2 id="ver-h" className="text-xl text-nile">Verifications</h2>
          <Pager tab="verifications" {...verifs} />
          <div className="card overflow-x-auto">
            <table className="table-tight w-full">
              <thead><tr><th>Updated</th><th>User</th><th>Outcome</th><th>Didit status</th><th>Session</th><th>ID type</th><th>Mode</th><th>Reviewed</th></tr></thead>
              <tbody>
                {verifs.rows.length === 0 && <tr><td colSpan={8} className="text-muted">No verifications yet.</td></tr>}
                {verifs.rows.map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap">{fmt(v.updated_at)}</td>
                    <td>{v.user_name ?? "Deleted account"}</td>
                    <td><OutcomeChip outcome={v.outcome} /></td>
                    <td>{v.didit_status ?? "—"}</td>
                    <td>{v.didit_session_number ? `#${v.didit_session_number}` : "—"}</td>
                    <td>{idTypeLabel(v.id_type_chosen)}</td>
                    <td>{v.mode}</td>
                    <td>{v.reviewed_by ? `${v.reviewed_by}: ${v.review_note ?? ""}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager tab="verifications" {...verifs} />
        </section>
      )}

      {tab === "webhooks" && hooks && (
        <section className="space-y-3" aria-labelledby="wh-h">
          <h2 id="wh-h" className="text-xl text-nile">Webhook events</h2>
          <Pager tab="webhooks" {...hooks} />
          <div className="card overflow-x-auto">
            <table className="table-tight w-full">
              <thead><tr><th>Received</th><th>Event</th><th>Type</th><th>Status</th><th>Signature</th><th>Processed</th></tr></thead>
              <tbody>
                {hooks.rows.length === 0 && <tr><td colSpan={6} className="text-muted">No webhooks yet{mock ? " (mock mode does not use webhooks)" : ""}.</td></tr>}
                {hooks.rows.map((e) => (
                  <tr key={e.event_id}>
                    <td className="whitespace-nowrap">{fmt(e.received_at)}</td>
                    <td className="font-mono text-xs">{e.event_id.slice(0, 18)}</td>
                    <td>{e.webhook_type ?? "—"}</td>
                    <td>{e.status ?? "—"}</td>
                    <td>{e.signature_method}</td>
                    <td>{e.processed ? "✓" : "…"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager tab="webhooks" {...hooks} />
        </section>
      )}

      {tab === "audit" && audit && (
        <section className="space-y-3" aria-labelledby="audit-h">
          <div>
            <h2 id="audit-h" className="text-xl text-nile">Audit log</h2>
            <p className="text-sm text-muted">Append-only. Records actions and status codes only, never ID images, ID numbers or contact details.</p>
          </div>
          <Pager tab="audit" {...audit} />
          <div className="card overflow-x-auto">
            <table className="table-tight w-full">
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead>
              <tbody>
                {audit.rows.length === 0 && <tr><td colSpan={4} className="text-muted">No entries yet.</td></tr>}
                {audit.rows.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap">{fmt(l.at)}</td>
                    <td className="whitespace-nowrap">{l.actor.startsWith("user:") ? l.actor_name ?? "Deleted account" : l.actor}</td>
                    <td><code className="text-xs">{l.action}</code></td>
                    <td className="text-xs text-muted min-w-[16rem]">
                      {Object.entries(l.detail ?? {})
                        .filter(([, v]) => v !== null && v !== "")
                        .map(([k, v]) => (
                          <span key={k} className="inline-block mr-3">
                            {k}: <b className="font-medium text-midnight">{String(v)}</b>
                          </span>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager tab="audit" {...audit} />
        </section>
      )}
    </div>
  );
}
