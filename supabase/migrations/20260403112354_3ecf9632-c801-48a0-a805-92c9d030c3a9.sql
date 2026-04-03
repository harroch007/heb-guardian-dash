
-- ============================================================
-- Co-Parent / Partner Role — Phase 1 Backend Foundation
-- ============================================================

-- 1. CREATE family_members TABLE
-- ============================================================
CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.parents(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'co_parent',
  receive_alerts boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  invited_email text NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT family_members_role_check CHECK (role = 'co_parent'),
  CONSTRAINT family_members_status_check CHECK (status IN ('pending', 'accepted', 'revoked')),
  CONSTRAINT family_members_no_self CHECK (owner_id IS DISTINCT FROM member_id)
);

CREATE UNIQUE INDEX idx_family_members_owner_email ON public.family_members (owner_id, invited_email);
CREATE INDEX idx_family_members_member_id ON public.family_members (member_id) WHERE status = 'accepted';
CREATE INDEX idx_family_members_invited_email ON public.family_members (invited_email) WHERE status = 'pending';

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- RLS for family_members
CREATE POLICY "Owners can view their family members"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Co-parents can view their own membership"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (member_id = auth.uid() AND status = 'accepted');

CREATE POLICY "Owners can insert family members"
  ON public.family_members FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their family members"
  ON public.family_members FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Admins can view all family members"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 2. SECURITY DEFINER FUNCTIONS
-- ============================================================

-- 2a. is_family_parent(child_id) — core gate for child_id-keyed tables
CREATE OR REPLACE FUNCTION public.is_family_parent(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM children
    WHERE id = p_child_id AND parent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM family_members fm
    JOIN children c ON c.parent_id = fm.owner_id
    WHERE c.id = p_child_id
      AND fm.member_id = auth.uid()
      AND fm.status = 'accepted'
      AND fm.role = 'co_parent'
  );
$$;

-- 2b. is_family_parent_for_device(device_id) — gate for device_id-keyed tables
CREATE OR REPLACE FUNCTION public.is_family_parent_for_device(p_device_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM devices d
    JOIN children c ON c.id = d.child_id
    WHERE d.device_id = p_device_id AND c.parent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM devices d
    JOIN children c ON c.id = d.child_id
    JOIN family_members fm ON fm.owner_id = c.parent_id
    WHERE d.device_id = p_device_id
      AND fm.member_id = auth.uid()
      AND fm.status = 'accepted'
      AND fm.role = 'co_parent'
  );
$$;

-- 2c. is_child_owner(child_id) — owner-only check for destructive actions
CREATE OR REPLACE FUNCTION public.is_child_owner(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM children
    WHERE id = p_child_id AND parent_id = auth.uid()
  );
$$;

-- 2d. get_family_owner_id() — resolve caller's family owner
CREATE OR REPLACE FUNCTION public.get_family_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id FROM parents WHERE id = auth.uid()),
    (SELECT fm.owner_id FROM family_members fm
     WHERE fm.member_id = auth.uid()
       AND fm.status = 'accepted'
     LIMIT 1)
  );
$$;

-- 3. INVITATION RPCs
-- ============================================================

-- 3a. invite_co_parent
CREATE OR REPLACE FUNCTION public.invite_co_parent(p_email text, p_receive_alerts boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_normalized_email text;
  v_existing record;
  v_new_id uuid;
BEGIN
  v_owner_id := auth.uid();
  v_normalized_email := lower(trim(p_email));

  -- Verify caller is a parent (owner)
  IF NOT EXISTS (SELECT 1 FROM parents WHERE id = v_owner_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_A_PARENT');
  END IF;

  -- Cannot invite yourself
  IF v_normalized_email = (SELECT lower(email) FROM parents WHERE id = v_owner_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_INVITE_SELF');
  END IF;

  -- Check for existing membership
  SELECT * INTO v_existing FROM family_members
  WHERE owner_id = v_owner_id AND invited_email = v_normalized_email;

  IF FOUND THEN
    IF v_existing.status = 'accepted' THEN
      RETURN jsonb_build_object('success', false, 'error', 'ALREADY_MEMBER');
    ELSIF v_existing.status = 'pending' THEN
      RETURN jsonb_build_object('success', false, 'error', 'ALREADY_INVITED');
    ELSIF v_existing.status = 'revoked' THEN
      -- Re-invite: reset to pending
      UPDATE family_members
      SET status = 'pending',
          member_id = NULL,
          receive_alerts = p_receive_alerts,
          invited_at = now(),
          accepted_at = NULL,
          revoked_at = NULL
      WHERE id = v_existing.id;
      RETURN jsonb_build_object('success', true, 'invite_id', v_existing.id, 'reinvited', true);
    END IF;
  END IF;

  -- Limit to 1 co-parent per owner for now
  IF EXISTS (SELECT 1 FROM family_members WHERE owner_id = v_owner_id AND status IN ('pending', 'accepted')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'MAX_MEMBERS_REACHED');
  END IF;

  INSERT INTO family_members (owner_id, invited_email, receive_alerts)
  VALUES (v_owner_id, v_normalized_email, p_receive_alerts)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'invite_id', v_new_id);
END;
$$;

-- 3b. accept_family_invite
CREATE OR REPLACE FUNCTION public.accept_family_invite(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_caller_email text;
BEGIN
  -- Get caller's email from auth
  SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();

  IF v_caller_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_EMAIL');
  END IF;

  v_caller_email := lower(trim(v_caller_email));

  -- Find the invite
  SELECT * INTO v_invite FROM family_members
  WHERE id = p_invite_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_NOT_FOUND');
  END IF;

  -- Email must match
  IF v_invite.invited_email != v_caller_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMAIL_MISMATCH');
  END IF;

  -- Cannot accept your own invite
  IF v_invite.owner_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_ACCEPT_OWN');
  END IF;

  -- Ensure caller has a parents row (they must have onboarded)
  IF NOT EXISTS (SELECT 1 FROM parents WHERE id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_ONBOARDED');
  END IF;

  -- Accept
  UPDATE family_members
  SET status = 'accepted',
      member_id = auth.uid(),
      accepted_at = now()
  WHERE id = p_invite_id;

  RETURN jsonb_build_object('success', true, 'owner_id', v_invite.owner_id);
END;
$$;

-- 3c. revoke_co_parent
CREATE OR REPLACE FUNCTION public.revoke_co_parent(p_membership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership record;
BEGIN
  SELECT * INTO v_membership FROM family_members
  WHERE id = p_membership_id AND owner_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_membership.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_REVOKED');
  END IF;

  UPDATE family_members
  SET status = 'revoked', revoked_at = now()
  WHERE id = p_membership_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. UPDATE RLS POLICIES
-- ============================================================
-- Strategy:
--   child_id-keyed tables → is_family_parent(child_id)
--   device_id-keyed tables → is_family_parent_for_device(device_id)
--   owner-only destructive → is_child_owner(child_id) or parent_id = auth.uid()

-- ── children ──
DROP POLICY IF EXISTS "Parents can view own children" ON public.children;
CREATE POLICY "Parents can view own children"
  ON public.children FOR SELECT TO public
  USING (public.is_family_parent(id));

-- INSERT stays owner-only
-- (keep existing "Parents can insert own children" unchanged)

DROP POLICY IF EXISTS "Parents can update own children" ON public.children;
CREATE POLICY "Parents can update own children"
  ON public.children FOR UPDATE TO public
  USING (public.is_family_parent(id));

-- DELETE stays owner-only
-- (keep existing "Parents can delete own children" unchanged)

-- ── alerts ──
DROP POLICY IF EXISTS "Parents can view their children alerts" ON public.alerts;
CREATE POLICY "Parents can view their children alerts"
  ON public.alerts FOR SELECT TO public
  USING (public.is_family_parent(child_id));

DROP POLICY IF EXISTS "Parents can view alerts from their children devices" ON public.alerts;
CREATE POLICY "Parents can view alerts from their children devices"
  ON public.alerts FOR SELECT TO public
  USING (public.is_family_parent_for_device(sender));

DROP POLICY IF EXISTS "Parents can update their children alerts" ON public.alerts;
CREATE POLICY "Parents can update their children alerts"
  ON public.alerts FOR UPDATE TO authenticated
  USING (public.is_family_parent(child_id));

DROP POLICY IF EXISTS "Parents can delete their children alerts" ON public.alerts;
CREATE POLICY "Parents can delete their children alerts"
  ON public.alerts FOR DELETE TO public
  USING (public.is_child_owner(child_id));

-- ── app_alerts ──
DROP POLICY IF EXISTS "Parents can view their children app alerts" ON public.app_alerts;
CREATE POLICY "Parents can view their children app alerts"
  ON public.app_alerts FOR SELECT TO public
  USING (public.is_family_parent(child_id));

-- ── app_policies ──
DROP POLICY IF EXISTS "Parents can view their children app policies" ON public.app_policies;
CREATE POLICY "Parents can view their children app policies"
  ON public.app_policies FOR SELECT TO authenticated
  USING (public.is_family_parent(child_id));

DROP POLICY IF EXISTS "Parents can insert app policies for their children" ON public.app_policies;
CREATE POLICY "Parents can insert app policies for their children"
  ON public.app_policies FOR INSERT TO authenticated
  WITH CHECK (public.is_family_parent(child_id));

DROP POLICY IF EXISTS "Parents can update their children app policies" ON public.app_policies;
CREATE POLICY "Parents can update their children app policies"
  ON public.app_policies FOR UPDATE TO authenticated
  USING (public.is_family_parent(child_id));

DROP POLICY IF EXISTS "Parents can delete their children app policies" ON public.app_policies;
CREATE POLICY "Parents can delete their children app policies"
  ON public.app_policies FOR DELETE TO authenticated
  USING (public.is_family_parent(child_id));

-- ── app_usage ──
DROP POLICY IF EXISTS "Parents can view their children app usage" ON public.app_usage;
CREATE POLICY "Parents can view their children app usage"
  ON public.app_usage FOR SELECT TO public
  USING (public.is_family_parent(child_id));

-- ── blocked_app_attempts ──
DROP POLICY IF EXISTS "Parents can view their children blocked attempts" ON public.blocked_app_attempts;
CREATE POLICY "Parents can view their children blocked attempts"
  ON public.blocked_app_attempts FOR SELECT TO authenticated
  USING (public.is_family_parent(child_id));

-- ── bonus_time_grants ──
DROP POLICY IF EXISTS "Parents can view their children bonus grants" ON public.bonus_time_grants;
CREATE POLICY "Parents can view their children bonus grants"
  ON public.bonus_time_grants FOR SELECT TO authenticated
  USING (public.is_family_parent(child_id));

DROP POLICY IF EXISTS "Parents can insert bonus grants for their children" ON public.bonus_time_grants;
CREATE POLICY "Parents can insert bonus grants for their children"
  ON public.bonus_time_grants FOR INSERT TO authenticated
  WITH CHECK (public.is_family_parent(child_id));

-- ── child_daily_insights ──
DROP POLICY IF EXISTS "Parents can view their children insights" ON public.child_daily_insights;
CREATE POLICY "Parents can view their children insights"
  ON public.child_daily_insights FOR SELECT TO public
  USING (public.is_family_parent(child_id));

-- ── child_periodic_summaries ──
DROP POLICY IF EXISTS "Parents can view their children summaries" ON public.child_periodic_summaries;
CREATE POLICY "Parents can view their children summaries"
  ON public.child_periodic_summaries FOR SELECT TO public
  USING (public.is_family_parent(child_id));

-- ── chores ──
-- chores uses parent_id directly, co-parent needs to see/manage chores created by the owner
DROP POLICY IF EXISTS "Parents manage chores" ON public.chores;
CREATE POLICY "Parents manage chores"
  ON public.chores FOR ALL TO authenticated
  USING (public.is_family_parent(child_id))
  WITH CHECK (public.is_family_parent(child_id));

-- ── device_commands ── (device_id-keyed)
DROP POLICY IF EXISTS "Parents can view commands for their children devices" ON public.device_commands;
CREATE POLICY "Parents can view commands for their children devices"
  ON public.device_commands FOR SELECT TO public
  USING (public.is_family_parent_for_device(device_id));

DROP POLICY IF EXISTS "Parents can insert commands for their children devices" ON public.device_commands;
CREATE POLICY "Parents can insert commands for their children devices"
  ON public.device_commands FOR INSERT TO public
  WITH CHECK (public.is_family_parent_for_device(device_id));

-- ── device_daily_health ── (device_id-keyed, SELECT only for parents)
DROP POLICY IF EXISTS "Parents can view their children daily health" ON public.device_daily_health;
CREATE POLICY "Parents can view their children daily health"
  ON public.device_daily_health FOR SELECT TO authenticated
  USING (public.is_family_parent_for_device(device_id));

-- ── device_daily_metrics ── (device_id-keyed, SELECT only for parents)
DROP POLICY IF EXISTS "Parents can view their children daily metrics" ON public.device_daily_metrics;
CREATE POLICY "Parents can view their children daily metrics"
  ON public.device_daily_metrics FOR SELECT TO authenticated
  USING (public.is_family_parent_for_device(device_id));

-- ── device_events ── (child_id-keyed)
DROP POLICY IF EXISTS "Parents can view their children device events" ON public.device_events;
CREATE POLICY "Parents can view their children device events"
  ON public.device_events FOR SELECT TO public
  USING (public.is_family_parent(child_id));

-- ── devices ── (child_id-keyed)
DROP POLICY IF EXISTS "Parents can view their children devices" ON public.devices;
CREATE POLICY "Parents can view their children devices"
  ON public.devices FOR SELECT TO public
  USING (public.is_family_parent(child_id));

-- ── installed_apps ──
DROP POLICY IF EXISTS "Parents can view their children installed apps" ON public.installed_apps;
CREATE POLICY "Parents can view their children installed apps"
  ON public.installed_apps FOR SELECT TO authenticated
  USING (public.is_family_parent(child_id));

-- ── nightly_usage_reports ──
DROP POLICY IF EXISTS "Parents can view their children nightly usage" ON public.nightly_usage_reports;
CREATE POLICY "Parents can view their children nightly usage"
  ON public.nightly_usage_reports FOR SELECT TO public
  USING (public.is_family_parent(child_id));

-- ── reward_bank ──
DROP POLICY IF EXISTS "Parents read reward_bank" ON public.reward_bank;
CREATE POLICY "Parents read reward_bank"
  ON public.reward_bank FOR SELECT TO authenticated
  USING (public.is_family_parent(child_id));

-- ── reward_transactions ──
DROP POLICY IF EXISTS "Parents read reward_transactions" ON public.reward_transactions;
CREATE POLICY "Parents read reward_transactions"
  ON public.reward_transactions FOR SELECT TO authenticated
  USING (public.is_family_parent(child_id));

-- ── schedule_windows ──
DROP POLICY IF EXISTS "Parents can view their children schedule windows" ON public.schedule_windows;
CREATE POLICY "Parents can view their children schedule windows"
  ON public.schedule_windows FOR SELECT TO authenticated
  USING (public.is_family_parent(child_id));

DROP POLICY IF EXISTS "Parents can insert schedule windows for their children" ON public.schedule_windows;
CREATE POLICY "Parents can insert schedule windows for their children"
  ON public.schedule_windows FOR INSERT TO authenticated
  WITH CHECK (public.is_family_parent(child_id));

DROP POLICY IF EXISTS "Parents can update their children schedule windows" ON public.schedule_windows;
CREATE POLICY "Parents can update their children schedule windows"
  ON public.schedule_windows FOR UPDATE TO authenticated
  USING (public.is_family_parent(child_id));

DROP POLICY IF EXISTS "Parents can delete their children schedule windows" ON public.schedule_windows;
CREATE POLICY "Parents can delete their children schedule windows"
  ON public.schedule_windows FOR DELETE TO authenticated
  USING (public.is_family_parent(child_id));

-- ── settings ──
DROP POLICY IF EXISTS "Parents can view their settings" ON public.settings;
CREATE POLICY "Parents can view their settings"
  ON public.settings FOR SELECT TO public
  USING (
    (parent_id = auth.uid())
    OR public.is_family_parent(child_id)
    OR (device_id IN (
      SELECT d.device_id FROM devices d
      JOIN children c ON c.id = d.child_id
      WHERE c.parent_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM family_members fm
           WHERE fm.owner_id = c.parent_id
             AND fm.member_id = auth.uid()
             AND fm.status = 'accepted'
         )
    ))
  );

DROP POLICY IF EXISTS "Parents can update their settings" ON public.settings;
CREATE POLICY "Parents can update their settings"
  ON public.settings FOR ALL TO public
  USING (
    (parent_id = auth.uid())
    OR public.is_family_parent(child_id)
  );

-- ── time_extension_requests ──
-- Uses parent_id directly — co-parent needs to see/approve
DROP POLICY IF EXISTS "Parents read own children requests" ON public.time_extension_requests;
CREATE POLICY "Parents read own children requests"
  ON public.time_extension_requests FOR SELECT TO authenticated
  USING (
    parent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.owner_id = parent_id
        AND fm.member_id = auth.uid()
        AND fm.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS "Parents update own children requests" ON public.time_extension_requests;
CREATE POLICY "Parents update own children requests"
  ON public.time_extension_requests FOR UPDATE TO authenticated
  USING (
    parent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.owner_id = parent_id
        AND fm.member_id = auth.uid()
        AND fm.status = 'accepted'
    )
  )
  WITH CHECK (
    parent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.owner_id = parent_id
        AND fm.member_id = auth.uid()
        AND fm.status = 'accepted'
    )
  );

-- ── ai_stack_requests ── (device_id-keyed)
DROP POLICY IF EXISTS "Parents can view their children ai stack requests" ON public.ai_stack_requests;
CREATE POLICY "Parents can view their children ai stack requests"
  ON public.ai_stack_requests FOR SELECT TO authenticated
  USING (public.is_family_parent_for_device(device_id));

-- ── alert_feedback ── (parent_id-keyed, co-parent inserts own feedback)
-- Keep parent_id = auth.uid() for INSERT/UPDATE (each parent owns their own feedback)
-- But allow SELECT of feedback for family children alerts
DROP POLICY IF EXISTS "Parents can select own feedback" ON public.alert_feedback;
CREATE POLICY "Parents can select own feedback"
  ON public.alert_feedback FOR SELECT TO authenticated
  USING (parent_id = auth.uid());

-- INSERT and UPDATE stay as parent_id = auth.uid() (unchanged)

-- 5. UPDATE RPCs
-- ============================================================

-- 5a. approve_chore — allow co-parent
CREATE OR REPLACE FUNCTION public.approve_chore(p_chore_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chore RECORD;
  v_today date;
  v_last_date date;
  v_current_streak int;
BEGIN
  -- Allow owner OR co-parent to approve
  SELECT * INTO v_chore FROM chores
  WHERE id = p_chore_id AND public.is_family_parent(child_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CHORE_NOT_FOUND');
  END IF;

  IF v_chore.status != 'completed_by_child' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

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

  -- Streak logic
  v_today := (now() AT TIME ZONE 'Asia/Jerusalem')::date;

  SELECT last_streak_date, current_streak
  INTO v_last_date, v_current_streak
  FROM reward_bank WHERE child_id = v_chore.child_id;

  IF v_last_date IS NULL OR v_last_date < v_today - 1 THEN
    UPDATE reward_bank
    SET current_streak = 1, last_streak_date = v_today
    WHERE child_id = v_chore.child_id;
  ELSIF v_last_date = v_today - 1 THEN
    UPDATE reward_bank
    SET current_streak = v_current_streak + 1, last_streak_date = v_today
    WHERE child_id = v_chore.child_id;
  END IF;

  -- If recurring, create next instance
  IF v_chore.is_recurring THEN
    INSERT INTO chores (child_id, parent_id, title, reward_minutes, is_recurring, recurrence_days, status)
    VALUES (v_chore.child_id, v_chore.parent_id, v_chore.title, v_chore.reward_minutes, true, v_chore.recurrence_days, 'pending');
  END IF;

  RETURN jsonb_build_object('success', true, 'reward_minutes', v_chore.reward_minutes);
END;
$$;

-- 5b. generate_new_pairing_code — allow co-parent
CREATE OR REPLACE FUNCTION public.generate_new_pairing_code(p_child_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_code TEXT;
BEGIN
    -- Verify caller is owner or co-parent
    IF NOT public.is_family_parent(p_child_id) THEN
      RETURN json_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;

    -- Generate random 6-digit code
    v_new_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

    -- Update child with new code + expiration (24 hours)
    UPDATE children
    SET pairing_code = v_new_code,
        pairing_code_expires_at = NOW() + INTERVAL '24 hours'
    WHERE id = p_child_id;

    -- Disconnect old device
    UPDATE devices
    SET child_id = NULL
    WHERE child_id = p_child_id;

    RETURN json_build_object(
        'success', true,
        'code', v_new_code,
        'expires_at', NOW() + INTERVAL '24 hours'
    );
END;
$$;
