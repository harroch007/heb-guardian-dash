// Static demo data for presentation mode

export const DEMO_CHILDREN = [
  {
    id: "demo-child-1",
    name: "נועם",
    parent_id: "demo-parent",
    date_of_birth: "2015-03-15",
    gender: "male",
    pairing_code: null,
  },
  {
    id: "demo-child-2",
    name: "מיכל",
    parent_id: "demo-parent",
    date_of_birth: "2018-07-22",
    gender: "female",
    pairing_code: null,
  },
];

export const DEMO_DEVICE = {
  device_id: "demo-device-001",
  child_id: "demo-child-1",
  battery_level: 78,
  latitude: 32.0853,
  longitude: 34.7818,
  last_seen: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
  address: "שדרות רוטשילד 45, תל אביב",
};

export const DEMO_APP_USAGE = [
  { app_name: "WhatsApp", package_name: "com.whatsapp", usage_minutes: 45 },
  { app_name: "TikTok", package_name: "com.tiktok", usage_minutes: 38 },
  { app_name: "YouTube", package_name: "com.youtube", usage_minutes: 32 },
  { app_name: "Instagram", package_name: "com.instagram", usage_minutes: 25 },
  { app_name: "Spotify", package_name: "com.spotify", usage_minutes: 18 },
];

export const DEMO_ALERTS = [
  {
    id: 1,
    child_id: "demo-child-1",
    child_name: "נועם",
    sender: "חבר מהכיתה",
    sender_display: "דני כ׳",
    chat_name: "קבוצת הכיתה",
    chat_type: "group",
    parent_message: "התגלתה שיחה עם ביטויים לא הולמים בקבוצת הכיתה. מומלץ לשוחח עם הילד על תקשורת מכבדת.",
    suggested_action: "שיחה עם הילד",
    category: "inappropriate_language",
    ai_risk_score: 65,
    ai_verdict: "review",
    ai_summary: "ביטויים לא הולמים בשיחה קבוצתית",
    ai_recommendation: "שוחחו עם הילד על חשיבות השפה המכבדת",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    is_processed: true,
    acknowledged_at: null,
    remind_at: null,
  },
  {
    id: 2,
    child_id: "demo-child-1",
    child_name: "נועם",
    sender: "מספר לא מוכר",
    sender_display: "052-555-1234",
    chat_name: null,
    chat_type: "private",
    parent_message: "התקבלה הודעה מאיש קשר לא מוכר עם בקשה למידע אישי. מומלץ לבדוק עם הילד.",
    suggested_action: "בדיקה מיידית",
    category: "stranger_contact",
    ai_risk_score: 82,
    ai_verdict: "alert",
    ai_summary: "בקשה למידע אישי מאיש קשר לא מוכר",
    ai_recommendation: "יש לבדוק מיידית ולשוחח עם הילד על בטיחות ברשת",
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    is_processed: true,
    acknowledged_at: null,
    remind_at: null,
  },
  {
    id: 3,
    child_id: "demo-child-2",
    child_name: "מיכל",
    sender: "שרה",
    sender_display: "שרה מהגן",
    chat_name: "שרה",
    chat_type: "private",
    parent_message: "זמן המסך היומי חרג מהמגבלה שנקבעה (3 שעות). שימוש נוכחי: 4 שעות ו-15 דקות.",
    suggested_action: "הגבלת זמן מסך",
    category: "screen_time",
    ai_risk_score: 45,
    ai_verdict: "info",
    ai_summary: "חריגה מזמן מסך מותר",
    ai_recommendation: "שקלו שיחה על ניהול זמן מסך בריא",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    is_processed: true,
    acknowledged_at: null,
    remind_at: null,
  },
];

export const DEMO_DAILY_METRICS = {
  metric_date: new Date().toISOString().split("T")[0],
  messages_scanned: 247,
  stacks_sent_to_ai: 12,
  alerts_sent: 2,
};

export const DEMO_RECENT_ALERTS = [
  {
    id: 1,
    parent_message: "התגלתה שיחה עם ביטויים לא הולמים בקבוצת הכיתה",
    sender_display: "דני כ׳",
    sender: "חבר",
    category: "inappropriate_language",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 2,
    parent_message: "בקשה למידע אישי מאיש קשר לא מוכר",
    sender_display: "052-555-1234",
    sender: null,
    category: "stranger_contact",
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];
