-- RPC: consume_ai_tokens
-- Pre-flight check before making AI request
-- Returns: {allowed, reason, tokens_remaining, is_subscribed, cycle_resets_at}

create or replace function consume_ai_tokens(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_subscription record;
  v_usage record;
  v_is_subscribed boolean := false;
  v_tokens_remaining bigint;
begin
  -- 1. Check subscription status (active = subscribed)
  select * into v_subscription
  from dodo_subscriptions
  where user_id = p_user_id
    and status = 'active'
  order by created_at desc
  limit 1;
  
  v_is_subscribed := (v_subscription.id is not null);
  
  -- If not subscribed, deny immediately
  if not v_is_subscribed then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'subscription_required',
      'tokens_remaining', 0,
      'is_subscribed', false
    );
  end if;
  
  -- 2. Get or create usage record
  select * into v_usage
  from ai_token_usage
  where user_id = p_user_id;
  
  if v_usage.user_id is null then
    -- First time user, create record with cycle start from subscription
    insert into ai_token_usage (user_id, tokens_used, cycle_start_date)
    values (
      p_user_id, 
      0, 
      coalesce(v_subscription.current_period_end - interval '1 month', now())
    )
    returning * into v_usage;
  end if;
  
  -- 3. Check if billing cycle has passed (lazy reset)
  -- If subscription's current_period_end indicates a new billing cycle, reset tokens
  if v_subscription.current_period_end is not null 
     and v_usage.cycle_start_date < (v_subscription.current_period_end - interval '1 month') then
    -- Reset the cycle
    update ai_token_usage
    set tokens_used = 0,
        cycle_start_date = v_subscription.current_period_end - interval '1 month',
        updated_at = now()
    where user_id = p_user_id
    returning * into v_usage;
  end if;
  
  -- 4. Calculate remaining tokens
  v_tokens_remaining := v_usage.tokens_limit - v_usage.tokens_used;
  
  -- 5. Check if quota exceeded
  if v_tokens_remaining <= 0 then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'quota_exceeded',
      'tokens_remaining', 0,
      'tokens_used', v_usage.tokens_used,
      'tokens_limit', v_usage.tokens_limit,
      'is_subscribed', true,
      'cycle_resets_at', v_subscription.current_period_end
    );
  end if;
  
  -- 6. Allowed!
  return jsonb_build_object(
    'allowed', true,
    'tokens_remaining', v_tokens_remaining,
    'tokens_used', v_usage.tokens_used,
    'tokens_limit', v_usage.tokens_limit,
    'is_subscribed', true,
    'cycle_resets_at', v_subscription.current_period_end
  );
end;
$$;

-- Grant execute to authenticated users
grant execute on function consume_ai_tokens(uuid) to authenticated;
grant execute on function consume_ai_tokens(uuid) to service_role;

comment on function consume_ai_tokens is 'Pre-flight check for AI token quota. Handles subscription check, lazy billing cycle reset, and quota validation.';
