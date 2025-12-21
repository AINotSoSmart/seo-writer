# Admin Operations API: ADMIN_API_KEY

This repository includes an admin-only endpoint [app/api/admin/dodo/subscriptions/ops/route.ts](app/api/admin/dodo/subscriptions/ops/route.ts:1) guarded by a static header key.

What is ADMIN_API_KEY?

- A project-local secret you define to protect the admin ops API.
- Not issued by Dodo Payments or Supabase.
- Set as an environment variable on your server and in local dev.

Where to set it

- Local development: add to [.env.local](.env.local:1):
  ADMIN_API_KEY=your-strong-random-string

- Vercel (recommended):
  - Project Settings → Environment Variables
  - Name: ADMIN_API_KEY
  - Value: your-strong-random-string
  - Environments: Preview and Production
  - Redeploy to apply

- Other hosting: set an environment variable named ADMIN_API_KEY for your runtime and redeploy.

How to generate a strong key

- Node.js:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
- OpenSSL:
  openssl rand -hex 32

Using the endpoint

- Request:
  GET /api/admin/dodo/subscriptions/ops?limit=100
- Required header:
  x-admin-api-key: $ADMIN_API_KEY

- Example (local dev):
  curl -sS -H "x-admin-api-key: $ADMIN_API_KEY" "http://localhost:3000/api/admin/dodo/subscriptions/ops?limit=100" | jq

Response fields
- scheduledCancellations: cancel_at_period_end=true, ordered by next_billing_date
- upcomingRenewals: status=active with next_billing_date
- recentCancelled: status=cancelled or canceled_at not null
- warnings: array of query warnings (if any)

Security recommendations
- Treat ADMIN_API_KEY like any other secret; never commit it.
- Rotate if exposed; update env and redeploy.
- Consider additional controls:
  - Restrict by IP allowlist (at your edge/load balancer)
  - Hide behind an internal admin UI with authentication
  - Replace header key with Supabase JWT check (e.g., require a specific role claim) if preferred

Alternative to header key (Supabase JWT example outline)
- Instead of checking a header, verify a Supabase-authenticated user and enforce a role claim before returning data.
- If you want this, replace the isAuthorized() check in [app/api/admin/dodo/subscriptions/ops/route.ts](app/api/admin/dodo/subscriptions/ops/route.ts:7) with your auth logic.

Notes
- This endpoint is optional; delete [app/api/admin/dodo/subscriptions/ops/route.ts](app/api/admin/dodo/subscriptions/ops/route.ts:1) if you prefer not to expose an admin API.
- For production, ensure DEBUG_DODO_WEBHOOK is disabled.