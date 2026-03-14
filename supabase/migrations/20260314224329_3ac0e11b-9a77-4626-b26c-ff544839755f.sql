INSERT INTO app_policies (child_id, package_name, app_name, is_blocked, policy_status, always_allowed)
VALUES
  ('6233e88a-0212-4682-a350-442681e95a5f', 'com.kippy.ai', 'KippyAI', false, 'approved', true),
  ('6233e88a-0212-4682-a350-442681e95a5f', 'com.google.android.apps.meetings', 'Meet', false, 'approved', true),
  ('6233e88a-0212-4682-a350-442681e95a5f', 'com.samsung.android.contacts', 'אנשי קשר', false, 'approved', true),
  ('6233e88a-0212-4682-a350-442681e95a5f', 'android.autoinstalls.config', 'Android Switch', false, 'approved', true)
ON CONFLICT (child_id, package_name) DO UPDATE SET always_allowed = true;