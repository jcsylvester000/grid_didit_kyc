# GRID Verified — Didit KYC prototype

Identity checks for GRID Property Ventures listings, built on [Didit](https://didit.me).
Tenants browse freely; the one-time ID + selfie check runs only when they book their first viewing.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Neon Postgres · Netlify

## Access

This is an internal app. Every page opens behind an **access-code screen** (default code `412099`,
override with `APP_ACCESS_CODE`). Access lasts 12 hours per browser; the lock icon in the header locks it again.
The check runs in `proxy.ts` before any page renders, so nothing is shown or sent until the code is entered.
The Didit webhook and `/api/health` stay open.

## Accounts and listing access (v0.3)

- **Register** (`/register`): name, email, optional PH mobile, password. **No ID at sign-up.**
- **Sign in / out** (`/login`). Passwords are hashed with scrypt; sessions are signed cookies (7 days).
- Demo accounts (password `GridDemo2026`): `maria@example.com` (new), `paolo@example.com` (already verified),
  `ana@example.com` (OFW). Shown on the sign-in page for the internal team.
- **Open listings**: full details and exact address for everyone; any signed-in user can book.
- **Verified-only listings**: exact address and booking unlock after a passed Didit check (reused after that).
- **My account**: progress tracker (account → identity verified → viewing booked), details, consents, viewings.
- **Admin**: Accounts table with each user's identity status; "Delete registered accounts" for test clean-up.

## What it does

| Journey | Where |
|---|---|
| Browse listings (no check) | `/` |
| Listing with exact address locked, "Book a viewing" | `/listings/[id]` |
| Grid-built consent (unticked box, "Not now"), choose ID, photo tips | `/verify` |
| Didit hosted verification (or simulated screen in mock mode) | Didit URL / `/mock-didit/[id]` |
| 5 outcomes: verified · retry · manual review · pending · declined | `/verify/result` |
| Reuse: verified users never repeat the check | automatic |
| My verification: what Grid stores, consents, viewings, deletion request | `/account` |
| Staff console: free-tier counter, review queue, pending, outage switch, webhooks, audit log | `/admin` |
| Didit webhook (signature-verified, idempotent) | `POST /api/didit/webhook` |
| Health check | `GET /api/health` |

Rules built in (from the KYC Readiness Report and Walkthrough Guide):
verify at the moment of value · verify once, reuse everywhere · never block the whole app ·
an unreadable **PhilID goes to manual review, never auto-decline** (PhilSys Act) · no rewards for verifying.

**Data:** Didit holds ID photos and selfies. Neon stores only results (status, name, birth date, ID type,
expiry, Didit session ID), consent records and an append-only audit log. No images, ID numbers or PhilSys numbers.

## Run locally

```powershell
npm install
copy .env.example .env.local   # then fill in values
npm run db:migrate             # optional; tables are also created on first request
npm run dev
```

Open http://localhost:3000. Use the **Demo user** menu (top right) to switch between:
Maria (new tenant), Paolo (returning, already verified) and Ana (new, OFW).
Admin: http://localhost:3000/admin (local default code `grid-admin-dev` when `ADMIN_ACCESS_CODE` is empty).

### Mock mode vs live mode
- **Mock** (no `DIDIT_API_KEY`): a simulated Didit screen lets you pick each result. No API calls, no cost.
- **Live** (key set): real Didit sessions. Locally the result page fetches the decision itself, so it works
  without the webhook. On Netlify the webhook delivers results automatically.

## Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `DIDIT_API_KEY` | Didit application API key (use the **sandbox** application first) |
| `DIDIT_WORKFLOW_ID` | Workflow UUID: ID Verification + Passive Liveness + Face Match + IP Analysis |
| `DIDIT_WEBHOOK_SECRET` | Webhook "secret shared key" from the Didit console |
| `DIDIT_API_BASE` | Optional, default `https://verification.didit.me` |
| `APP_URL` | Public site URL, no trailing slash (Didit redirects back here) |
| `APP_ACCESS_CODE` | Optional. Access code for the whole app (default `412099`) |
| `ADMIN_ACCESS_CODE` | Code for `/admin` staff console (required in production) |
| `SESSION_SECRET` | Long random string; signs cookies (required in production) |

## Didit console setup

1. Create a **sandbox** application (keeps test checks off the free 500 / month).
2. Build a workflow with ID Verification, Passive Liveness, Face Match, Device & IP Analysis only
   (these are the free-tier features). Do **not** add a Didit questionnaire for consent; Grid's own screen handles it.
3. Copy the API key and workflow ID into `.env.local` / Netlify.
4. Webhook URL: `https://<your-site>/api/didit/webhook`. Copy its secret into `DIDIT_WEBHOOK_SECRET`.
5. Callback URL is sent per session (`APP_URL/verify/result?v=...`); no console setting needed.
6. Set data retention (6–12 months for leasing; confirm with counsel) and keep face-template storage off.

Note: Didit allows 10 session creations per minute on free workflows. Over the limit, users see
"Verification pending" and can retry.

## Deploy to Netlify

1. New site from GitHub repo `jcsylvester000/grid_didit_kyc`. Build settings come from `netlify.toml`.
2. Add the environment variables above (Site configuration → Environment variables).
3. Deploy, then set `APP_URL` to the live URL and redeploy. Add the webhook URL in the Didit console.

## Photos

Listing and page photos are samples from [Unsplash](https://unsplash.com) (free under the Unsplash License),
listed with credits in `lib/photos.ts`. They're resized and converted to AVIF/WebP by Unsplash's CDN through
`lib/image-loader.ts`, so no Netlify image processing is used. Real listings must use the owner's own photos.

## Not in this version (next)
Face re-check at signing (Biometric Authentication), lease application + proof of address, OFW owner
authorization + title name match, broker PRC check, AML screening for high-value deals, real login,
SMS/email notifications, automatic retry of pending checks.

*Prototype. Listings and people are invented. Not legal advice; have counsel review consent wording and retention.*
