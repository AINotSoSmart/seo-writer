-- Backfill dodo_payments table for user "raw" (b831b0c9-9f21-4a25-9068-11481e4ec408)
-- Based on DodoPayments API data retrieved 2026-01-18

-- Payment for nimoscripts@gmail.com (raw)
INSERT INTO dodo_payments (
    user_id,
    dodo_payment_id,
    pricing_plan_id,
    amount,
    currency,
    status,
    credits,
    metadata
) VALUES (
    'b831b0c9-9f21-4a25-9068-11481e4ec408',                           -- user_id (raw)
    'pay_0NWTwfILpIiJv3UUqPtej',                                      -- dodo_payment_id
    'c12a7c0f-7701-49bd-a8ab-fcc143855d56',                           -- pricing_plan_id
    0,                                                                  -- amount (0 PLN due to discount)
    'PLN',                                                              -- currency
    'completed',                                                        -- status
    10,                                                                 -- credits (from pricing plan)
    '{"source": "backfill", "payment_date": "2026-01-17T11:54:51.374915+00:00", "subscription_id": "sub_0NWTwfIRu36HOeyHixbJC", "customer_email": "nimoscripts@gmail.com"}'::jsonb
)
ON CONFLICT (dodo_payment_id) DO NOTHING;

-- Also backfill payment for harvanshjatt@gmail.com (your own user)
INSERT INTO dodo_payments (
    user_id,
    dodo_payment_id,
    pricing_plan_id,
    amount,
    currency,
    status,
    credits,
    metadata
) VALUES (
    '779e4d11-587f-477a-8929-745092306821',                           -- user_id (harvanshjatt)
    'pay_0NWTrYxIxiOenKP6bs23r',                                      -- dodo_payment_id
    'c12a7c0f-7701-49bd-a8ab-fcc143855d56',                           -- pricing_plan_id
    0,                                                                  -- amount (0 INR due to discount)
    'INR',                                                              -- currency
    'completed',                                                        -- status
    10,                                                                 -- credits (from pricing plan)
    '{"source": "backfill", "payment_date": "2026-01-17T11:28:01.778912+00:00", "subscription_id": "sub_0NWTrYxNW44LI0D0YfjyN", "customer_email": "harvanshjatt@gmail.com"}'::jsonb
)
ON CONFLICT (dodo_payment_id) DO NOTHING;
