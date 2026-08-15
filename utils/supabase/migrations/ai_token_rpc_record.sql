-- RPC: record_ai_usage
-- Called after Gemini API returns to record actual token consumption

create or replace function record_ai_usage(
  p_user_id uuid,
  p_tokens_used bigint
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_new_total bigint;
  v_limit bigint;
begin
  -- Update usage, incrementing tokens_used
  update ai_token_usage
  set tokens_used = tokens_used + p_tokens_used,
      last_request_at = now(),
      updated_at = now()
  where user_id = p_user_id
  returning tokens_used, tokens_limit into v_new_total, v_limit;
  
  -- If no record exists (edge case), create one
  if v_new_total is null then
    insert into ai_token_usage (user_id, tokens_used)
    values (p_user_id, p_tokens_used)
    returning tokens_used, tokens_limit into v_new_total, v_limit;
  end if;
  
  return jsonb_build_object(
    'tokens_used', v_new_total,
    'tokens_remaining', greatest(0, v_limit - v_new_total),
    'tokens_limit', v_limit
  );
end;
$$;

-- Grant execute permissions
grant execute on function record_ai_usage(uuid, bigint) to authenticated;
grant execute on function record_ai_usage(uuid, bigint) to service_role;

comment on function record_ai_usage is 'Records actual AI token consumption after Gemini API call completes.';
