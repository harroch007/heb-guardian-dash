-- 1. Create refund_reward_minutes RPC
CREATE OR REPLACE FUNCTION public.refund_reward_minutes(p_child_id uuid, p_minutes_to_refund integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  IF p_minutes_to_refund <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  UPDATE reward_bank
  SET balance_minutes = balance_minutes + p_minutes_to_refund,
      updated_at = now()
  WHERE child_id = p_child_id
  RETURNING balance_minutes INTO v_new_balance;

  IF NOT FOUND THEN
    INSERT INTO reward_bank (child_id, balance_minutes, updated_at)
    VALUES (p_child_id, p_minutes_to_refund, now())
    RETURNING balance_minutes INTO v_new_balance;
  END IF;

  INSERT INTO reward_transactions (child_id, amount_minutes, source)
  VALUES (p_child_id, p_minutes_to_refund, 'bonus_refund');

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- 2. Replace redeem_reward_minutes WITHOUT bonus_time_grants INSERT
CREATE OR REPLACE FUNCTION public.redeem_reward_minutes(p_child_id uuid, p_minutes integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF p_minutes <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  SELECT balance_minutes INTO v_balance
  FROM reward_bank
  WHERE child_id = p_child_id;

  IF v_balance IS NULL OR v_balance < p_minutes THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_BALANCE');
  END IF;

  UPDATE reward_bank
  SET balance_minutes = balance_minutes - p_minutes,
      updated_at = now()
  WHERE child_id = p_child_id;

  INSERT INTO reward_transactions (child_id, amount_minutes, source)
  VALUES (p_child_id, -p_minutes, 'bank_redeem');

  RETURN jsonb_build_object('success', true, 'remaining_balance', v_balance - p_minutes);
END;
$$;