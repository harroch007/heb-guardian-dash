
-- ============================================================
-- 1. TABLES
-- ============================================================

-- Chores table
CREATE TABLE public.chores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  title text NOT NULL,
  reward_minutes integer NOT NULL DEFAULT 10,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_days integer[] DEFAULT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Reward bank (one row per child)
CREATE TABLE public.reward_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE UNIQUE,
  balance_minutes integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reward transactions log
CREATE TABLE public.reward_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  amount_minutes integer NOT NULL,
  source text NOT NULL,
  chore_id uuid REFERENCES public.chores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. RLS
-- ============================================================
ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_transactions ENABLE ROW LEVEL SECURITY;

-- Parents: full CRUD on their children's chores
CREATE POLICY "Parents manage chores" ON public.chores
  FOR ALL TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- Anon (Android): can read chores for any child (device knows child_id)
CREATE POLICY "Anon read chores" ON public.chores
  FOR SELECT TO anon
  USING (true);

-- Anon (Android): can update status to completed_by_child
CREATE POLICY "Anon complete chores" ON public.chores
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (status = 'completed_by_child');

-- Parents: read reward_bank for their children
CREATE POLICY "Parents read reward_bank" ON public.reward_bank
  FOR SELECT TO authenticated
  USING (child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));

-- Anon: read reward_bank
CREATE POLICY "Anon read reward_bank" ON public.reward_bank
  FOR SELECT TO anon
  USING (true);

-- Parents: read reward_transactions
CREATE POLICY "Parents read reward_transactions" ON public.reward_transactions
  FOR SELECT TO authenticated
  USING (child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));

-- Anon: read reward_transactions
CREATE POLICY "Anon read reward_transactions" ON public.reward_transactions
  FOR SELECT TO anon
  USING (true);

-- ============================================================
-- 3. REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reward_bank;

-- ============================================================
-- 4. RPCs
-- ============================================================

-- approve_chore: parent approves a completed chore, credits reward bank
CREATE OR REPLACE FUNCTION public.approve_chore(p_chore_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chore RECORD;
BEGIN
  -- Get chore and verify ownership
  SELECT * INTO v_chore FROM chores
  WHERE id = p_chore_id AND parent_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CHORE_NOT_FOUND');
  END IF;

  IF v_chore.status != 'completed_by_child' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  -- Update chore status
  UPDATE chores SET status = 'approved', approved_at = now() WHERE id = p_chore_id;

  -- Upsert reward bank
  INSERT INTO reward_bank (child_id, balance_minutes, updated_at)
  VALUES (v_chore.child_id, v_chore.reward_minutes, now())
  ON CONFLICT (child_id)
  DO UPDATE SET
    balance_minutes = reward_bank.balance_minutes + v_chore.reward_minutes,
    updated_at = now();

  -- Log transaction
  INSERT INTO reward_transactions (child_id, amount_minutes, source, chore_id)
  VALUES (v_chore.child_id, v_chore.reward_minutes, 'chore_approved', p_chore_id);

  -- If recurring, create next instance
  IF v_chore.is_recurring THEN
    INSERT INTO chores (child_id, parent_id, title, reward_minutes, is_recurring, recurrence_days, status)
    VALUES (v_chore.child_id, v_chore.parent_id, v_chore.title, v_chore.reward_minutes, true, v_chore.recurrence_days, 'pending');
  END IF;

  RETURN jsonb_build_object('success', true, 'reward_minutes', v_chore.reward_minutes);
END;
$$;

-- reject_chore: parent rejects a completed chore
CREATE OR REPLACE FUNCTION public.reject_chore(p_chore_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE chores SET status = 'rejected'
  WHERE id = p_chore_id AND parent_id = auth.uid() AND status = 'completed_by_child';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CHORE_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- redeem_reward_minutes: Android calls this to use banked minutes
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

  SELECT balance_minutes INTO v_balance FROM reward_bank WHERE child_id = p_child_id;

  IF v_balance IS NULL OR v_balance < p_minutes THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_BALANCE');
  END IF;

  -- Deduct from bank
  UPDATE reward_bank SET balance_minutes = balance_minutes - p_minutes, updated_at = now()
  WHERE child_id = p_child_id;

  -- Add to bonus_time_grants so get_device_settings picks it up
  INSERT INTO bonus_time_grants (child_id, bonus_minutes, grant_date, granted_by)
  VALUES (p_child_id, p_minutes, (now() AT TIME ZONE 'Asia/Jerusalem')::date, 'reward_bank');

  -- Log transaction
  INSERT INTO reward_transactions (child_id, amount_minutes, source)
  VALUES (p_child_id, -p_minutes, 'bank_redeem');

  RETURN jsonb_build_object('success', true, 'remaining_balance', v_balance - p_minutes);
END;
$$;
