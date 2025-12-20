Comprehensive plan for Dodo Payments Checkout Sessions-based subscriptions ($79/mo, 30 credits, cancel anytime)

MCP usage summary
- Context7 MCP (why): Retrieved the latest Dodo Payments docs for Subscriptions, Checkout Sessions, Webhooks signature verification, Payment Methods, and Subscription updates to ensure accuracy.
  - Subscriptions overview and PATCH /subscriptions: https://docs.dodopayments.com/features/subscription
  - Checkout Sessions integration: https://docs.dodopayments.com/developer-resources/checkout-session
  - Webhook signature verification: https://docs.dodopayments.com/developer-resources/webhooks
  - Payment Methods: https://docs.dodopayments.com/features/payment-methods and UPI considerations: https://docs.dodopayments.com/features/upi
  - Subscriptions API create/update/cancel examples: https://docs.dodopayments.com/api-reference/misc/charge-subscriptions
- Project analysis (why): Read your credit system and billing hook to design integration points.
  - Credits API: [lib/credits.ts](lib/credits.ts:1)
  - Client credit state: [lib/credit-manager.ts](lib/credit-manager.ts:1)
  - Billing hook wrapper references '@/lib/dodopayments': [hooks/useBilling.ts](hooks/useBilling.ts:1)
  - Existing migrations/tables for Dodo: utils/supabase/migrations/dodo_pricing_plans.sql, dodo_subscriptions.sql, dodo_payments.sql, dodo_webhook_events.sql

Target outcome
- Single subscription product: $79/month, provides 30 article credits per billing cycle
- Hosted Checkout Sessions for subscription purchase
- All eligible payment methods automatically available; do not restrict via API unless you need to
- Cancel anytime with cancel_at_period_end behavior (no immediate termination)
- Webhook-driven provisioning: add 30 credits on activate and on each renewal; skip/hold on dunning
- Regional support: UPI/UPI Autopay, wallets, Google Pay, cards — shown if eligible by region/currency/account

Architecture blueprint

1) Product and pricing in Dodo Payments (Dashboard)
- Create one Product (type: subscription) “AI SEO Writer — Monthly 30 Credits”
  - Price: USD 79.00 billed monthly
  - Optionally set trial days if needed (can override per Checkout Session; ref: docs)
- Record the product_id in config (env or DB)
  - Recommended: add to Supabase table if you already use it (you have dodo_pricing_plans)
  - Or use an env var DODO_SUBSCRIPTION_PRODUCT_ID
- References:
  - Subscriptions feature: https://docs.dodopayments.com/features/subscription
  - Create checkout session for subscriptions: https://docs.dodopayments.com/developer-resources/subscription-integration-guide

2) Data model and persistence
- Use existing tables (you already have these migrations; confirm schema fields):
  - dodo_pricing_plans: hold mapping to Dodo product_id for your single plan
  - dodo_subscriptions: store user_id, dodo_subscription_id, status, cancel_at_period_end, current_period_end, next_billing_date
  - dodo_payments: store dodo_payment_id, dodo_checkout_session_id, pricing_plan_id, amounts
  - dodo_webhook_events: store unique dodo_event_id and event_type for idempotency
- If not in schema yet, add:
  - status text (active|on_hold|cancelled|failed)
  - cancel_at_period_end boolean
  - current_period_end timestamptz
  - next_billing_date timestamptz
  - customer_email (optional)
- You can keep not storing dodo_customer_id (as your migration notes indicate); embed your Supabase user_id in checkout metadata instead.

3) Server-side endpoints (Next.js App Router)
- Create server routes (SDK only on server; never from client):
  - Checkout Session create: [app/api/dodopayments/checkout/route.ts](app/api/dodopayments/checkout/route.ts)
    - POST: creates a Checkout Session using dodopayments Node SDK
    - Input: none (user_id inferred from Supabase session) or accepts plan key
    - Body you send to Dodo:
      - product_cart: [{ product_id: DODO_SUBSCRIPTION_PRODUCT_ID, quantity: 1 }]
      - return_url: https://your-app.com/billing/return?sid={session_id}
      - customer: email/name if available
      - metadata: { user_id: <supabase_user_id> } to map back from webhooks
      - Do NOT set allowed_payment_method_types to allow all eligible (default behavior)
    - Returns: checkout_url to redirect user
    - References:
      - Checkout Sessions: https://docs.dodopayments.com/developer-resources/checkout-session
      - TS SDK init and session create example: https://docs.dodopayments.com/developer-resources/sdks/typescript
  - Checkout Session status (optional): [app/api/dodopayments/checkout/status/route.ts](app/api/dodopayments/checkout/status/route.ts)
    - GET: confirms session status if you want client polling after return (optional)
  - Webhook handler: [app/api/dodopayments/webhook/route.ts](app/api/dodopayments/webhook/route.ts)
    - POST: verify signature (unwrap) with DODO_PAYMENTS_WEBHOOK_KEY, route subscription events reliably
    - Idempotency: store dodo_event_id in dodo_webhook_events — skip if seen
    - Handle events:
      - subscription.active: create dodo_subscriptions row if new; add 30 credits; set status=active; persist current_period_end if available
      - subscription.renewed: add 30 credits; update period end/next billing
      - subscription.on_hold: set status=on_hold; do not add credits; notify user to update payment method
      - subscription.cancelled: set status=cancelled; if cancel_at_period_end true, treat as future stop
      - subscription.failed: set status=failed and log
    - References:
      - Webhooks verification (SDK unwrap): https://docs.dodopayments.com/developer-resources/webhooks
      - Event types overview: https://docs.dodopayments.com/developer-resources/subscription-integration-guide
  - Cancel subscription (period-end): [app/api/dodopayments/subscription/cancel/route.ts](app/api/dodopayments/subscription/cancel/route.ts)
    - POST: calls client.subscriptions.update(sub_id, { cancel_at_period_end: true })
    - Update table with local state
    - Reference: https://docs.dodopayments.com/api-reference/misc/charge-subscriptions
  - Update payment method: [app/api/dodopayments/subscription/update-payment-method/route.ts](app/api/dodopayments/subscription/update-payment-method/route.ts)
    - POST: initiates “update payment method” flow for on_hold or by user request
    - For on_hold, Dodo will attempt to charge remaining dues and reactivate
    - Reference: https://docs.dodopayments.com/features/subscription (update payment method section)

4) Credit provisioning logic
- On subscription.active and subscription.renewed:
  - Option A (recommended non-rollover): set exact monthly credits to 30. Implement as: compute newBalance = 30; update to 30. This requires a “set” operation. You can add a helper to set credits directly via Supabase.
  - Option B (rollover): add 30 to current balance
- Use your existing CreditService:
  - Add: [lib/credits.ts](lib/credits.ts:1)
  - Deduct: [lib/credits.ts](lib/credits.ts:84)
- For immediate UI sync, your client can rely on the Realtime listeners in [lib/credit-manager.ts](lib/credit-manager.ts:1)

5) Billing UI flow
- Entry points:
  - Pricing/Upgrade CTA → POST to [app/api/dodopayments/checkout/route.ts](app/api/dodopayments/checkout/route.ts), then redirect to returned checkout_url
  - Return page: reads sid from query, optionally calls status endpoint to confirm; show success state
- Account dashboard:
  - Show subscription status, next billing date, and “Cancel renewal” action calling [app/api/dodopayments/subscription/cancel/route.ts](app/api/dodopayments/subscription/cancel/route.ts)
  - When status=on_hold, show “Update payment method” button to call [app/api/dodopayments/subscription/update-payment-method/route.ts](app/api/dodopayments/subscription/update-payment-method/route.ts)
- If you prefer prebuilt UI pieces, integrate BillingSDK UI components for the Subscribe/Manage flow via CLI (shadcn style). Use only for UI; keep server calls in API routes.

6) Payment Methods and UPI/Autopay
- Default behavior (recommended): do not set allowed_payment_method_types, so all eligible methods are shown automatically based on region/currency/transaction type. Docs: https://docs.dodopayments.com/features/payment-methods
- Constraints:
  - Some methods (e.g., iDEAL, Bancontact, P24, EPS) are EUR and often one-time only; not available for subscriptions (see changelog v1.14: https://docs.dodopayments.com/changelog/v1.14)
  - UPI + UPI Autopay availability depends on merchant capabilities, currency, and customer region (docs: https://docs.dodopayments.com/features/upi). If enabled on your account and the transaction qualifies, Checkout will show them.
- If you must restrict methods (not recommended here), include allowed_payment_method_types in the session create payload.

7) Security, compliance, and reliability
- Secret management:
  - DODO_PAYMENTS_API_KEY (server only)
  - DODO_PAYMENTS_WEBHOOK_KEY (server only)
  - DODO_ENVIRONMENT=test_mode or live_mode (you already have this in .env)
- Base URLs:
  - test_mode → https://test.dodopayments.com
  - live_mode → https://live.dodopayments.com
- Webhook verification:
  - Use SDK webhooks.unwrap(rawBody, headers) and reject if invalid
  - Ensure you read the raw body in Next.js App Router (use request.text()) before JSON parsing
- Idempotency:
  - Persist dodo_event_id in dodo_webhook_events and skip duplicates
- Error handling and retries:
  - Treat webhook endpoints as at-least-once; implement idempotency and return 2xx on success
  - Log errors with enough context (subscription_id, event_id)
- PCI:
  - Do not handle card data. Hosted Checkout Sessions keep you out of PCI scope for forms.

8) Mapping subscriptions to your users
- Do not rely on dodo_customer_id (your schema notes say you removed it)
- Put Supabase user_id into checkout metadata and/or customer metadata so it flows back in webhooks
- On webhook receipt, read metadata.user_id and link to your tables (dodo_subscriptions, credits)

9) Dunning and cancellation behavior
- On on_hold (failed renewal):
  - Mark status=on_hold; disable additional credits
  - Offer “Update payment method,” calling your update-payment-method endpoint; successful update reactivates and charges dues (docs)
- On cancel_at_period_end=true:
  - Keep access/credits until end of current period; on next cycle no renewal and no new credits
  - If using non-rollover policy, you don’t need to remove credits immediately; simply stop future top-ups

10) Sandbox test plan
- Environment:
  - Set DODO_ENVIRONMENT=test_mode
  - Set API and webhook keys for test in your environment
- End-to-end cases:
  - New subscription purchase → subscription.active → 30 credits added
  - Renewal event simulated → subscription.renewed → +30 credits (or set to 30 if non-rollover)
  - Failed renewal → subscription.on_hold → no credits; update payment method → reactivated
  - Cancel (period-end) → cancel_at_period_end true → ensure no new renewal credit on next cycle
- Webhooks:
  - Verify signature must fail with incorrect key
  - Retry handling is idempotent — re-sending the same event_id does not double-add credits
- Payment methods:
  - Validate that default behavior shows eligible methods based on your test account’s capabilities

11) Production rollout checklist
- Validate all env configuration in live_mode and rotate webhook key on go-live
- Lock down API routes to server-only (no client SDK usage with secrets)
- Ensure observability:
  - Log event_id, subscription_id, and user_id on all webhook paths
  - Set up alerts for on_hold and failed events
- Verify tax/legal requirements are configured in Dodo dashboard as needed
- Smoke test real card in live_mode with a real purchase and refund (if desired) before general availability

12) Implementation tasks mapped to your codebase
- Server routes to add (no client secrets in browser):
  - [app/api/dodopayments/checkout/route.ts](app/api/dodopayments/checkout/route.ts) — POST to create checkout session
  - [app/api/dodopayments/webhook/route.ts](app/api/dodopayments/webhook/route.ts) — POST webhook receiver with signature verification and idempotency
  - [app/api/dodopayments/subscription/cancel/route.ts](app/api/dodopayments/subscription/cancel/route.ts) — POST cancel at period end
  - [app/api/dodopayments/subscription/update-payment-method/route.ts](app/api/dodopayments/subscription/update-payment-method/route.ts) — POST update payment method
- Credit updates:
  - Use [lib/credits.ts](lib/credits.ts:1) to add or set credits in webhook handlers
  - Your realtime UI already listens via [lib/credit-manager.ts](lib/credit-manager.ts:1)
- Billing hook:
  - Your [hooks/useBilling.ts](hooks/useBilling.ts:1) references '@/lib/dodopayments'. Ensure that wrapper exposes a server function for checkoutSessions.create and returns checkout_url to client, or call your new API route from client.
- Database:
  - Confirm dodo_* tables; add fields for status and dates if missing
  - Add FK from dodo_subscriptions.user_id → auth.users.id for referential integrity

Key references (from Context7 MCP)
- Subscriptions overview and PATCH cancel-at-period-end:
  - https://docs.dodopayments.com/features/subscription
  - https://docs.dodopayments.com/api-reference/misc/charge-subscriptions
- Checkout Sessions:
  - https://docs.dodopayments.com/developer-resources/checkout-session
  - TypeScript SDK patterns: https://docs.dodopayments.com/developer-resources/sdks/typescript
- Webhooks signature verification (unwrap):
  - https://docs.dodopayments.com/developer-resources/webhooks
- Payment Methods and eligibility:
  - https://docs.dodopayments.com/features/payment-methods
  - UPI considerations: https://docs.dodopayments.com/features/upi
  - EU one-time only methods (changelog v1.14): https://docs.dodopayments.com/changelog/v1.14

Environment and currency rules to observe
- Base URLs by environment:
  - test_mode: https://test.dodopayments.com
  - live_mode: https://live.dodopayments.com
- Amounts (if/when used directly) are in smallest unit for the currency (e.g., 7900 for USD $79). Checkout Sessions typically use product_id so pricing resides in dashboard.

Security requirements this plan covers
- Webhook signature verification with SDK unwrap and raw body
- All secrets in env vars (never on client)
- Idempotency on webhooks via event store
- Error handling and retries for webhook processing

Scalability and reliability
- Hosted Checkout Sessions offload complex payment UIs
- Webhooks are stateless and idempotent; scale horizontally
- Use background job (if needed) for heavy post-processing, but credits update is fast enough in handler

Default payment methods scope
- Leave allowed_payment_method_types unset → all eligible methods auto-enabled (cards, wallets, Google Pay, UPI/UPI Autopay where eligible). For subscriptions, some local methods are not supported; Checkout will hide them automatically based on eligibility.

Credit policy note
- If you want non-rollover (always 30 max per cycle), add a “setCredits(userId, 30)” path in the webhook handler. Your current CreditService has add/deduct; you can implement a set operation server-side to update to 30 exactly.
- If you prefer rollover, call addCredits(userId, 30) each renewal.

This plan is ready to implement against your current codebase. It uses Checkout Sessions, supports all eligible payment methods, gives 30 credits per cycle, and cancels at next billing date per your requirement. It conforms to Dodo Payments documentation and your existing Supabase credits design.