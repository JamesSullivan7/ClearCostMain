# ClearCost Environment Variables

All env vars are set in the Vercel project settings.

## Required

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL (e.g., `https://xxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase anon/public key (safe for client-side, RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only, bypasses RLS) |
| `SITE_URL` | Production URL (e.g., `https://clearcostinventory.com`) — used for CORS, OAuth redirects, email links |

## Stripe (Billing)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (required in production) |
| `STRIPE_PRICE_STARTER` | Stripe Price ID for Starter tier |
| `STRIPE_PRICE_PRO` | Stripe Price ID for Pro tier |
| `STRIPE_PRICE_BUSINESS` | Stripe Price ID for Business tier |

## Plaid (Bank Connection)

| Variable | Description |
|----------|-------------|
| `PLAID_CLIENT_ID` | Plaid client ID |
| `PLAID_SECRET` | Plaid secret key |
| `PLAID_ENV` | `sandbox`, `development`, or `production` |

## QuickBooks

| Variable | Description |
|----------|-------------|
| `QUICKBOOKS_CLIENT_ID` | Intuit OAuth client ID |
| `QUICKBOOKS_CLIENT_SECRET` | Intuit OAuth client secret |
| `QUICKBOOKS_REDIRECT_URI` | OAuth callback URL (e.g., `https://clearcostinventory.com/api/quickbooks/auth?action=callback`) |
| `QUICKBOOKS_ENV` | `sandbox` or `production` |

## Etsy

| Variable | Description |
|----------|-------------|
| `ETSY_API_KEY` | Etsy API key (keystring) |
| `ETSY_REDIRECT_URI` | OAuth callback URL (e.g., `https://clearcostinventory.com/api/ecommerce?action=etsy-callback`) |

## Shopify

| Variable | Description |
|----------|-------------|
| `SHOPIFY_API_KEY` | Shopify app API key |
| `SHOPIFY_API_SECRET` | Shopify app secret (used for webhook HMAC + OAuth) |

## Shipping (EasyPost)

| Variable | Description |
|----------|-------------|
| `EASYPOST_API_KEY` | EasyPost API key |

## Email Notifications

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key for sending low-stock email alerts |

## Security

| Variable | Description |
|----------|-------------|
| `OAUTH_STATE_SECRET` | Secret for HMAC-signing Etsy/Shopify OAuth state params (any random string) |
| `CRON_SECRET` | Optional secret for authenticating Vercel Cron Job calls |

## Vercel KV

| Variable | Description |
|----------|-------------|
| `KV_REST_API_URL` | Vercel KV REST API URL (auto-set when you link a KV store) |
| `KV_REST_API_TOKEN` | Vercel KV REST API token (auto-set when you link a KV store) |

## Supabase Schema Note

The `daily_snapshots` table needs to be created before the snapshot cron and dashboard trend chart will work:

```sql
CREATE TABLE daily_snapshots (
  id BIGSERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, date)
);
CREATE INDEX idx_snapshots_business ON daily_snapshots(business_id);
CREATE INDEX idx_snapshots_date ON daily_snapshots(business_id, date DESC);

ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY snapshots_select ON daily_snapshots FOR SELECT USING (business_id = get_business_id());
CREATE POLICY snapshots_insert ON daily_snapshots FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY snapshots_delete ON daily_snapshots FOR DELETE USING (business_id = get_business_id());
```

## Vercel Cron (optional)

Add to `vercel.json` to enable daily snapshots:
```json
"crons": [{ "path": "/api/cron/snapshot", "schedule": "0 6 * * *" }]
```
