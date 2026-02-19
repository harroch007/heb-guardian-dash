ALTER TABLE public.training_dataset
ADD COLUMN alert_id bigint REFERENCES public.alerts(id) ON DELETE CASCADE;