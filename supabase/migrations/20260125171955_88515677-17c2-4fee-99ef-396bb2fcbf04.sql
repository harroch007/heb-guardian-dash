-- הענקת הרשאת אדמין למשתמש yariv@kippyai.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('532d5cab-aa32-4647-81e8-dab1016306c2', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;