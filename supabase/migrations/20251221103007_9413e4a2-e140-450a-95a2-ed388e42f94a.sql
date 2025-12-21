-- Insert existing user into parents table
INSERT INTO public.parents (id, full_name, email)
VALUES ('aafb81de-60c1-44d2-8d0e-7b7684ef7c2a', 'yarivtm@gmail.com', 'yarivtm@gmail.com')
ON CONFLICT (id) DO NOTHING;