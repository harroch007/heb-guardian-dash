CREATE TABLE IF NOT EXISTS public.chat_thread_hides (
  friendship_id uuid NOT NULL REFERENCES public.friendships(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (friendship_id, participant_id)
);

ALTER TABLE public.chat_thread_hides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own hides" ON public.chat_thread_hides;
CREATE POLICY "Owner manages own hides"
  ON public.chat_thread_hides FOR ALL
  TO authenticated
  USING (participant_id = auth.uid())
  WITH CHECK (participant_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_chat_thread_hides_participant
  ON public.chat_thread_hides(participant_id);

CREATE OR REPLACE FUNCTION public.hide_chat_thread(p_friendship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE id = p_friendship_id
      AND (requester_id = auth.uid() OR receiver_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.chat_thread_hides (friendship_id, participant_id, hidden_at)
  VALUES (p_friendship_id, auth.uid(), now())
  ON CONFLICT (friendship_id, participant_id)
  DO UPDATE SET hidden_at = EXCLUDED.hidden_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hide_chat_thread(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';