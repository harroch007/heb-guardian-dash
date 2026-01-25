-- הוספת האימייל לרשימת המורשים
INSERT INTO public.allowed_emails (email, added_by, notes)
VALUES ('yariv@kippyai.com', 'system', 'CEO admin account')
ON CONFLICT (email) DO NOTHING;