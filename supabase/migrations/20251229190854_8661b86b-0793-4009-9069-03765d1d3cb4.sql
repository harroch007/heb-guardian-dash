-- Insert parent record for test user
INSERT INTO public.parents (id, full_name, email, phone)
VALUES (
  '68b93315-67d9-490f-8673-a867f3e06bd2',
  'דני כהן',
  'test.parent@kippy.app',
  '050-1234567'
)
ON CONFLICT (id) DO UPDATE SET
  full_name = 'דני כהן',
  phone = '050-1234567';

-- Insert test children
INSERT INTO public.children (id, parent_id, name, date_of_birth, gender, phone_number, city, school, pairing_code)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '68b93315-67d9-490f-8673-a867f3e06bd2', 'יובל כהן', '2012-06-15', 'male', '050-1111111', 'תל אביב', 'בית ספר השלום', '123456'),
  ('22222222-2222-2222-2222-222222222222', '68b93315-67d9-490f-8673-a867f3e06bd2', 'מיכל כהן', '2015-03-22', 'female', '050-2222222', 'תל אביב', 'בית ספר האור', '654321')
ON CONFLICT (id) DO NOTHING;

-- Insert test devices
INSERT INTO public.devices (device_id, child_id, battery_level, latitude, longitude, last_seen)
VALUES 
  ('device-yuval-001', '11111111-1111-1111-1111-111111111111', 85, 32.0853, 34.7818, NOW()),
  ('device-michal-002', '22222222-2222-2222-2222-222222222222', 62, 32.0853, 34.7818, NOW())
ON CONFLICT (device_id) DO UPDATE SET
  child_id = EXCLUDED.child_id,
  battery_level = EXCLUDED.battery_level,
  last_seen = NOW();

-- Insert test alerts for Yuval
INSERT INTO public.alerts (child_id, device_id, content, risk_score, ai_risk_score, source, sender_display, chat_type, ai_verdict, ai_summary, ai_recommendation_short, ai_explanation_short, should_alert, is_processed)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'device-yuval-001', 'שיחה עם איש זר שביקש תמונות', 85, 85, 'WhatsApp', 'Unknown Contact', 'PRIVATE', 'HIGH_RISK', 'ילד קיבל בקשה לתמונות מאיש זר', 'דברו עם הילד מיד', 'בקשה לתמונות מאדם לא מוכר היא סימן אזהרה חמור', true, true),
  ('11111111-1111-1111-1111-111111111111', 'device-yuval-001', 'חבר שואל אם רוצה לשחק כדורגל מחר', 15, 15, 'WhatsApp', 'דני מהכיתה', 'PRIVATE', 'SAFE', 'שיחה רגילה על ספורט', 'אין צורך בפעולה', 'שיחה חברית תקינה', false, true),
  ('11111111-1111-1111-1111-111111111111', 'device-yuval-001', 'שיחה על בחנים בבית ספר עם מילים קשות', 55, 55, 'Instagram', 'יוסי השכן', 'GROUP', 'MEDIUM_RISK', 'שיחה על לחץ לימודי', 'עקבו אחרי מצב הרוח', 'לחץ לימודי יכול להשפיע על הילד', true, true);

-- Insert test alerts for Michal  
INSERT INTO public.alerts (child_id, device_id, content, risk_score, ai_risk_score, source, sender_display, chat_type, ai_verdict, ai_summary, ai_recommendation_short, ai_explanation_short, should_alert, is_processed)
VALUES 
  ('22222222-2222-2222-2222-222222222222', 'device-michal-002', 'חברה מהכיתה הזמינה למסיבת יום הולדת', 10, 10, 'WhatsApp', 'נועה החברה', 'PRIVATE', 'SAFE', 'הזמנה למסיבת יום הולדת', 'אין צורך בפעולה', 'שיחה חברית רגילה', false, true),
  ('22222222-2222-2222-2222-222222222222', 'device-michal-002', 'מישהו כתב דברים לא נעימים על המראה שלה', 70, 70, 'TikTok', 'משתמש אנונימי', 'PUBLIC', 'HIGH_RISK', 'תגובה פוגענית על המראה', 'דברו עם הילדה על בריונות ברשת', 'תגובות על מראה יכולות לפגוע בדימוי העצמי', true, true);

-- Insert app usage data for today
INSERT INTO public.app_usage (device_id, child_id, package_name, app_name, usage_minutes, usage_date)
VALUES 
  ('device-yuval-001', '11111111-1111-1111-1111-111111111111', 'com.google.android.youtube', 'YouTube', 45, CURRENT_DATE),
  ('device-yuval-001', '11111111-1111-1111-1111-111111111111', 'com.zhiliaoapp.musically', 'TikTok', 30, CURRENT_DATE),
  ('device-yuval-001', '11111111-1111-1111-1111-111111111111', 'com.whatsapp', 'WhatsApp', 25, CURRENT_DATE),
  ('device-yuval-001', '11111111-1111-1111-1111-111111111111', 'com.instagram.android', 'Instagram', 20, CURRENT_DATE),
  ('device-yuval-001', '11111111-1111-1111-1111-111111111111', 'com.mojang.minecraftpe', 'Minecraft', 35, CURRENT_DATE),
  ('device-michal-002', '22222222-2222-2222-2222-222222222222', 'com.google.android.youtube', 'YouTube', 30, CURRENT_DATE),
  ('device-michal-002', '22222222-2222-2222-2222-222222222222', 'com.zhiliaoapp.musically', 'TikTok', 50, CURRENT_DATE),
  ('device-michal-002', '22222222-2222-2222-2222-222222222222', 'com.whatsapp', 'WhatsApp', 15, CURRENT_DATE),
  ('device-michal-002', '22222222-2222-2222-2222-222222222222', 'com.disney.disneyplus', 'Disney+', 40, CURRENT_DATE)
ON CONFLICT (device_id, package_name, usage_date) DO UPDATE SET
  usage_minutes = EXCLUDED.usage_minutes;