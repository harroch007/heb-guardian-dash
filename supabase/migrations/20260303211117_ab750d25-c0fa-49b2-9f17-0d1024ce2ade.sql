
-- =============================================
-- 1. Add platform column to 4 tables
-- =============================================

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'WHATSAPP';

ALTER TABLE public.training_dataset
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'WHATSAPP';

ALTER TABLE public.ai_stack_requests
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'WHATSAPP';

ALTER TABLE public.daily_chat_stats
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'WHATSAPP';

-- =============================================
-- 2. Update unique indexes to include platform
-- =============================================

-- alerts: recreate unique index with platform
DROP INDEX IF EXISTS public.alerts_device_event_unique;
CREATE UNIQUE INDEX alerts_device_event_unique
  ON public.alerts (device_id, client_event_id, platform)
  WHERE client_event_id IS NOT NULL;

-- daily_chat_stats: recreate unique constraint with platform
ALTER TABLE public.daily_chat_stats
  DROP CONSTRAINT IF EXISTS daily_chat_stats_stat_date_device_id_chat_name_key;
DROP INDEX IF EXISTS daily_chat_stats_stat_date_device_id_chat_name_key;
CREATE UNIQUE INDEX daily_chat_stats_stat_date_device_id_chat_name_platform_key
  ON public.daily_chat_stats (stat_date, device_id, chat_name, platform);

-- =============================================
-- 3. Recreate create_alert RPC with p_platform
-- =============================================

-- Drop the existing 12-param version
DROP FUNCTION IF EXISTS public.create_alert(text, integer, text, text, text, integer, text, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_alert(
  p_message text,
  p_risk_level integer,
  p_source text,
  p_device_id text,
  p_chat_type text DEFAULT 'PRIVATE'::text,
  p_message_count integer DEFAULT 0,
  p_contact_hash text DEFAULT NULL::text,
  p_pii_redacted_count integer DEFAULT 0,
  p_sender_display text DEFAULT NULL::text,
  p_author_type text DEFAULT 'UNKNOWN'::text,
  p_chat_name text DEFAULT NULL::text,
  p_client_event_id text DEFAULT NULL::text,
  p_platform text DEFAULT 'WHATSAPP'::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_child_id UUID;
    v_alert_id BIGINT;
BEGIN
    -- Stamp first_seen_at only once (first real device activity)
    UPDATE public.devices
    SET first_seen_at = COALESCE(first_seen_at, now())
    WHERE device_id = p_device_id;

    SELECT child_id INTO v_child_id
    FROM devices
    WHERE device_id = p_device_id;

    INSERT INTO alerts (
        content,
        risk_score,
        sender,
        sender_display,
        device_id,
        chat_type,
        message_count,
        child_id,
        is_processed,
        should_alert,
        author_type,
        chat_name,
        client_event_id,
        platform
    ) VALUES (
        p_message,
        p_risk_level,
        p_source,
        p_sender_display,
        p_device_id,
        p_chat_type,
        p_message_count,
        v_child_id,
        false,
        true,
        p_author_type,
        p_chat_name,
        p_client_event_id,
        p_platform
    )
    ON CONFLICT (device_id, client_event_id, platform) WHERE client_event_id IS NOT NULL
    DO UPDATE SET content = alerts.content
    RETURNING id INTO v_alert_id;

    RETURN v_alert_id;
END;
$function$;

-- =============================================
-- 4. Recreate increment_daily_chat_stat with p_platform
-- =============================================

DROP FUNCTION IF EXISTS public.increment_daily_chat_stat(text, uuid, text, text, integer, date);

CREATE OR REPLACE FUNCTION public.increment_daily_chat_stat(
  p_device_id text,
  p_child_id uuid,
  p_chat_name text,
  p_chat_type text,
  p_delta integer DEFAULT 1,
  p_stat_date date DEFAULT ((now() AT TIME ZONE 'Asia/Jerusalem'::text))::date,
  p_platform text DEFAULT 'WHATSAPP'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.daily_chat_stats (
    stat_date, device_id, child_id, chat_name, chat_type, message_count, updated_at, platform
  )
  VALUES (
    p_stat_date,
    p_device_id,
    p_child_id,
    p_chat_name,
    COALESCE(p_chat_type, 'UNKNOWN'),
    GREATEST(p_delta, 0),
    now(),
    p_platform
  )
  ON CONFLICT (stat_date, device_id, chat_name, platform)
  DO UPDATE SET
    message_count = public.daily_chat_stats.message_count + GREATEST(EXCLUDED.message_count, 0),
    updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$function$;
