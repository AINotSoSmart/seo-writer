# DodoPayments Subscription System - Internal Documentation

> **Last Updated:** January 2026  
> **Context:** This doc covers how our subscription system works, common issues we've debugged, and the complete lifecycle of subscriptions.

---

## Table of Contents

1. [Subscription Flow Overview](#subscription-flow-overview)
2. [Database Schema](#database-schema)
3. [Webhook Events & Processing](#webhook-events--processing)
4. [Common Issues & Fixes](#common-issues--fixes)
5. [Cancellation Flow](#cancellation-flow)
6. [UI States](#ui-states)

---

## Subscription Flow Overview

### When User Subscribes

```
User clicks "Subscribe" on /subscribe page
    ↓
Checkout session created with metadata: { user_id, source: "subscribe_page" }
    ↓
User completes payment on DodoPayments checkout
    ↓
DodoPayments sends webhooks in this order:
    1. subscription.created → status set to 'pending'
    2. subscription.active (or subscription.activated) → status set to 'active'
    3. payment.succeeded → credits provisioned
    ↓
User redirected back to /subscribe → sees Management Dashboard
```

### Key Files

| File | Purpose |
|------|---------|
| `app/(protected)/subscribe/page.tsx` | Main subscription page, fetches user's subscription |
| `app/api/dodopayments/webhook/route.ts` | Processes all DodoPayments webhooks |
| `components/subscribe/ManageSubscription.tsx` | Management UI (cancel, restore, update payment) |
| `lib/dodopayments.ts` | API helpers for interacting with DodoPayments |

---

## Database Schema

### `dodo_subscriptions` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to auth.users |
| `dodo_subscription_id` | TEXT | Unique ID from DodoPayments (e.g., `sub_0NWTrYxNW44LI0D0YfjyN`) |
| `pricing_plan_id` | UUID | Foreign key to dodo_pricing_plans |
| `status` | TEXT | One of: `pending`, `active`, `cancelled`, `expired` |
| `cancel_at_period_end` | BOOLEAN | `true` if user scheduled cancellation |
| `next_billing_date` | TIMESTAMP | When next payment will be charged |
| `current_period_end` | TIMESTAMP | When current billing period ends (derived from `next_billing_date`) |
| `canceled_at` | TIMESTAMP | When subscription was actually terminated |
| `metadata` | JSONB | Raw webhook payload stored for debugging |

### Important: Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Checkout initiated but payment not completed yet |
| `active` | Subscription is active, user has access |
| `cancelled` | Subscription has ended (period expired) |
| `expired` | Alternative to cancelled (same effect) |

---

## Webhook Events & Processing

### Event Types We Handle

Located in `app/api/dodopayments/webhook/route.ts`:

| Event Type | What We Do |
|------------|------------|
| `subscription.created` | Create record with `status: 'pending'` |
| `subscription.activated` | Update to `status: 'active'` |
| `subscription.active` | Update to `status: 'active'` ⚠️ (was buggy, see below) |
| `payment.succeeded` | Provision credits to user |
| `subscription.cancelled` / `subscription.canceled` | Set `status: 'cancelled'`, set `canceled_at` |
| `subscription.plan_changed` | Update pricing plan mapping |
| `subscription.updated` | Update service fields (dates, etc.) |

### Critical Code: Status Mapping (Line ~560)

```typescript
const status = (eventType === 'subscription.activated' || eventType === 'subscription.active') ? 'active' : 'pending'
```

⚠️ **Previously this was buggy!** It only checked for `subscription.activated`, so `subscription.active` events were incorrectly setting status to `pending`.

---

## Common Issues & Fixes

### Issue 1: Subscribed User Sees Checkout Card Instead of Dashboard

**Symptoms:**
- User has paid and DodoPayments shows `active`
- But `/subscribe` page shows checkout card instead of management UI

**Root Cause 1: Query Logic Bug**

The `getLatestSubscription()` function was ordering by `created_at DESC` and taking the first result. This means if a user has multiple subscription attempts (some failed), a newer `pending` or `failed` record would "shadow" the older `active` one.

**Fix:** Query with priority order:
```typescript
async function getLatestSubscription(userId: string) {
    // Priority 1: Look for an active subscription first
    const { data: activeSub } = await supabase
        .from('dodo_subscriptions')
        .select(...)
        .eq('user_id', userId)
        .eq('status', 'active')  // ← Priority filter
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    
    if (activeSub) return activeSub
    
    // Priority 2: Look for pending (checkout in progress)
    // Priority 3: Fall back to most recent (for cancelled/expired states)
}
```

**Root Cause 2: Webhook Status Mapping Bug**

DodoPayments sends `subscription.active` event, but our code only checked for `subscription.activated`:

```diff
- const status = eventType === 'subscription.activated' ? 'active' : 'pending'
+ const status = (eventType === 'subscription.activated' || eventType === 'subscription.active') ? 'active' : 'pending'
```

### Issue 2: Local Status Shows `pending` but DodoPayments Shows `active`

**How to Debug:**

1. Check the `metadata` column in `dodo_subscriptions` - it stores the raw webhook payload
2. Look at `metadata.raw.status` - this is what DodoPayments sent
3. Compare with the `status` column - if different, the webhook mapping was wrong

**Quick Fix SQL:**
```sql
UPDATE dodo_subscriptions 
SET status = 'active', updated_at = now()
WHERE dodo_subscription_id = 'sub_XXXXX';
```

---

## Cancellation Flow

### Two Types of "Cancel"

| Type | What Happens | User Access |
|------|--------------|-------------|
| **Cancel at period end** | Schedules cancellation for billing period end | ✅ Keeps access until period ends |
| **Immediate cancel** | (Not implemented) Would terminate immediately | ❌ Loses access right away |

### Our Flow: Cancel at Period End

```
User clicks "Cancel at period end" button
    ↓
UI calls apiCancelSubscription(subscription_id)
    ↓
We call DodoPayments API to schedule cancellation
    ↓
DodoPayments sets: cancel_at_next_billing_date = true
    ↓
Webhook received: subscription.updated
    ↓
We update locally: cancel_at_period_end = true
    ↓
User sees: "Restore subscription" button + "Plan ends on [date]"
    ↓
... time passes, billing period ends ...
    ↓
DodoPayments sends: subscription.cancelled webhook
    ↓
We update:
    - status = 'cancelled'
    - cancel_at_period_end = false
    - canceled_at = <timestamp>
    ↓
User visits /subscribe → sees checkout card to resubscribe
```

### Database Fields for Cancellation

| Field | During "Cancel at period end" | After Period Expires |
|-------|------------------------------|----------------------|
| `status` | `active` (still active!) | `cancelled` |
| `cancel_at_period_end` | `true` | `false` |
| `canceled_at` | `null` | `<timestamp>` |

### Webhook Handler for Cancellation (Lines 620-634)

```typescript
} else if (eventType === 'subscription.cancelled' || eventType === 'subscription.canceled') {
    await upsertSubscriptionFromEvent(supabase, {
        user_id: effective_user_id,
        dodo_subscription_id,
        status: 'cancelled',  // ← Sets final status
        raw: subscriptionObj,
    })
    await updateSubscriptionServiceFields(supabase, dodo_subscription_id, subscriptionObj, eventType)
}
```

The `updateSubscriptionServiceFields` function (lines 364-366) also does:
```typescript
if (eventType && eventType.toLowerCase().includes('cancel')) {
    update.cancel_at_period_end = false;
    update.canceled_at = toISO(canceledAtRaw) || new Date().toISOString();
}
```

---

## UI States

### `/subscribe` Page Logic

| Subscription State | UI Shown |
|--------------------|----------|
| No subscription | Checkout Card |
| `status: 'pending'` | Checkout Card (or loading state) |
| `status: 'active'` + `cancel_at_period_end: false` | Management Dashboard + "Cancel at period end" button |
| `status: 'active'` + `cancel_at_period_end: true` | Management Dashboard + "Restore subscription" button |
| `status: 'cancelled'` | Checkout Card (to resubscribe) |

### ManageSubscription.tsx Button Logic

```tsx
{subscription.status === 'active' && !localCancelAtPeriodEnd && (
    <Button variant="destructive">Cancel at period end</Button>
)}
{subscription.status === 'active' && localCancelAtPeriodEnd && (
    <Button variant="default">Restore subscription</Button>
)}
```

---

## Debugging Checklist

When subscription issues occur:

1. **Check DodoPayments Dashboard** - What does their system show?
2. **Check `dodo_subscriptions` table** - What's our local status?
3. **Check `metadata.raw.status`** - What did the webhook send?
4. **Check `dodo_webhook_events` table** - Did we receive and process the webhook?
5. **Look for multiple subscriptions** - Does user have newer pending/failed records shadowing the active one?

### Useful SQL Queries

**Find all subscriptions for a user:**
```sql
SELECT * FROM dodo_subscriptions 
WHERE user_id = 'USER_ID_HERE' 
ORDER BY created_at DESC;
```

**Check webhook events for a subscription:**
```sql
SELECT * FROM dodo_webhook_events 
WHERE payload::text LIKE '%sub_SUBSCRIPTION_ID%' 
ORDER BY created_at DESC;
```

**Fix a subscription status manually:**
```sql
UPDATE dodo_subscriptions 
SET status = 'active', updated_at = now()
WHERE dodo_subscription_id = 'sub_XXXXX';
```

---

## Summary: Production-Grade Flow ✅

```
┌─────────────────────────────────────────────────────────────────┐
│  User subscribes  →  status: 'active'                           │
│                      cancel_at_period_end: false                 │
│                      UI: Management Dashboard + "Cancel" button  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (User clicks "Cancel at period end")
┌─────────────────────────────────────────────────────────────────┐
│  status: 'active' (still active!)                                │
│  cancel_at_period_end: true                                      │
│  UI: Dashboard + "Restore subscription" button + "Ends on X"    │
│  → User can still use your app until the period ends            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Billing period ends, Dodo sends webhook)
┌─────────────────────────────────────────────────────────────────┐
│  status: 'cancelled'                                             │
│  cancel_at_period_end: false                                     │
│  canceled_at: <timestamp>                                        │
│  UI: Checkout Card (to resubscribe)                             │
└─────────────────────────────────────────────────────────────────┘
```

This is the standard SaaS subscription pattern used by Stripe, Paddle, and other major payment providers. ✅
