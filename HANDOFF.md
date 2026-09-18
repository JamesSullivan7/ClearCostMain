# ClearCost: handoff

Start here. Last updated 18 September 2026.

> **This repository is public.** Keep secrets, customer names, credentials and
> anything from `.env.local` out of this file and out of every commit.
> `.gitignore` excludes `.env*.local` and the local demo seed script for exactly
> this reason.

## What ClearCost is

A multi-tenant inventory and cost-analysis app for small businesses: products,
recipes and their margins, stock levels, sales, and daily snapshots of each
business's position over time.

## Stack

| Piece | What |
|---|---|
| Frontend | Vanilla JavaScript single-page app (`index.html`, `js/`) |
| API | Vercel serverless functions in `api/`, shared code in `api/_lib/` |
| Data | Supabase: auth, plus Postgres with row-level security |
| Cache | Vercel KV |
| Integrations | Plaid, QuickBooks, Etsy, Shopify, EasyPost, Stripe. Mostly unconfigured in production, so they fall back to sandbox or mock behaviour |
| Hosting | Vercel project `clear-cost`. A push to `main` deploys production |

There is no test suite and no build step.

## How data access is meant to work

- **`api/data.js` is the model to follow.** It uses the anon key with the
  caller's JWT, so Postgres row-level security decides what each tenant sees.
  RLS is enabled on every table it can reach.
- **The service-role client bypasses RLS for every tenant.** It belongs only on
  paths a stranger cannot reach. Today that is the snapshot cron alone, behind
  `CRON_SECRET`.

## Where it stands

**The daily snapshot cron runs, for the first time.** Fixed on 17 and 18
September 2026:

1. It could never have run. A wrong require path (`../../_lib/auth` from
   `api/cron/`) crashed it at module load on every invocation.
2. Its auth check let through a request with no `Authorization` header at all,
   and anything starting `Bearer ey`. It now fails closed: no `CRON_SECRET`, or
   a header that does not match it exactly, is a 401.
3. It reported `success` when the database was unreachable. A failed lookup is
   now a 500 carrying the reason.

Verified in production: 401 for all three unauthenticated variants, 200 with
the secret, and the first real run wrote one snapshot per business. A second
run the same day skipped them all, so it does not duplicate.

**`CRON_SECRET` is now required** on Vercel Production. Without it, the endpoint
refuses every call and no snapshots get written.

## Running it locally

```bash
vercel dev
```

It serves on port 3000. **`vercel dev` injects the project's Development
environment from Vercel, not `.env.local`**, so a missing variable has to be
added in the Vercel dashboard under Development. Without the Supabase variables
there, `/api/data` crashes with `FUNCTION_INVOCATION_FAILED`.

## Things that have bitten this project before

- **Supabase's free tier pauses a project after about a week idle**, and its
  hostname stops resolving. The symptom is `TypeError: fetch failed`, or a 500,
  on every data route, never an obvious "paused" message. Fix: restore it in the
  Supabase dashboard. The daily cron now queries the database every morning,
  which should keep it awake; worth confirming after a quiet week.
- **Environment values pasted through PowerShell have picked up a BOM and a
  literal `\r\n`.** Server code trims them. Any script that parses `.env.local`
  must strip them too.
- **A cached DNS answer can make a restored database look dead.** On a VPN, a
  resolver can keep serving "does not exist" for a while. Check with
  DNS-over-HTTPS (`cloudflare-dns.com/dns-query`) before assuming it is down.

## Known bugs

Reported in August 2026 and **not re-verified since**. Confirm each one before
fixing it.

1. The Plaid and QuickBooks client services send no `Authorization` header, so
   those calls always return 401.
2. Settings' System Status always shows "Not Configured".
3. The `SITE_URL` environment variable is set to the Supabase URL.
4. `js/supabase.js` carries a hardcoded fallback URL and key, and
   `api/config.js` is never fetched.
5. `products.photo_id` is `BIGINT`, but the app stores storage-path strings in
   it. Needs `ALTER COLUMN ... TYPE TEXT`, which has to run in the Supabase SQL
   editor, not through the REST API.
6. Inside the snapshot loop, the per-business queries still ignore their errors.
   Only the business list is checked so far.

## Progressing the build

A parked feature idea, not started: **Best Sellers**, "what to order more of".

1. A dashboard panel ranking units sold over 7, 30 and 90 days, crossed with
   recipe margins as a velocity-by-margin quadrant, and top sellers exploded
   through their recipes into a critical-materials list that feeds reordering.
2. Import a point-of-sale item-sales CSV mapped by SKU, to capture per-item sales
   for made-to-order products, which are not recorded today.
3. A live point-of-sale API sync, following the existing Etsy and Shopify
   pattern.

A sensible first session: work down the known bugs, then decide whether Best
Sellers is next.
