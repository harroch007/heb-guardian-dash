-- Update handle_new_user to support Google Auth (name field instead of full_name)
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.parents (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.email
    ),
    NEW.email
  );
  RETURN NEW;
END;
$function$;

-- Insert existing user manually (already logged in via Google)
INSERT INTO public.parents (id, full_name, email)
VALUES (
  'aafb81de-60c1-44d2-8d0e-7b7684ef7c2a',
  'Yariv Harroch',
  'yarivtm@gmail.com'
)
ON CONFLICT (id) DO NOTHING;