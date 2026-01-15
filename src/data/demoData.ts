// Static demo data for presentation mode

export const DEMO_PARENT = {
  name: "יריב",
};

export const DEMO_CHILDREN = [
  {
    id: "demo-child-1",
    name: "רואי",
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

export const DEMO_DAILY_STATS = {
  messages_scanned: 468,
  messages_sent_to_ai: 21,
  alerts_sent: 1,
  last_updated: "18:45",
  context_message: "רוב השיח היום היה שגרתי, זוהתה נקודת תשומת לב אחת.",
};

export const DEMO_AI_INSIGHTS = [
  "נרשמה היום פעילות חברתית גבוהה מול מספר חברים קבועים.",
  "רואי בילה זמן משמעותי באפליקציות חברתיות ומשחקים.",
  "זוהתה אינטראקציה אחת חריגה שהובילה להתראה, ללא סימנים חוזרים.",
];

export const DEMO_TOP_FRIENDS = ["דניאל", "עומר", "נועם"];

export const DEMO_TOP_APPS = [
  { name: "TikTok", usage: "1:45 שעות" },
  { name: "WhatsApp", usage: "1:10 שעות" },
  { name: "Roblox", usage: "55 דקות" },
];

export const DEMO_DAILY_CONTEXT = "רמת הפעילות היום דומה לימים האחרונים.";

export const DEMO_DEVICE_STATUS = {
  location: "מדינת היהודים 85, הרצליה",
  battery: 86,
  last_update: "לפני 6 דקות",
};

export const DEMO_DEVICE = {
  device_id: "demo-device-001",
  child_id: "demo-child-1",
  battery_level: 86,
  latitude: 32.1656,
  longitude: 34.8467,
  last_seen: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
  address: "מדינת היהודים 85, הרצליה",
};

export const DEMO_APP_USAGE = [
  { app_name: "TikTok", package_name: "com.tiktok", usage_minutes: 105 },
  { app_name: "WhatsApp", package_name: "com.whatsapp", usage_minutes: 70 },
  { app_name: "Roblox", package_name: "com.roblox", usage_minutes: 55 },
  { app_name: "Instagram", package_name: "com.instagram", usage_minutes: 25 },
  { app_name: "Spotify", package_name: "com.spotify", usage_minutes: 18 },
];

export const DEMO_ALERTS = [
  {
    id: 1,
    child_id: "demo-child-1",
    child_name: "רואי",
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
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    is_processed: true,
    acknowledged_at: null,
    remind_at: null,
  },
  {
    id: 2,
    child_id: "demo-child-1",
    child_name: "רואי",
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
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
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
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    is_processed: true,
    acknowledged_at: null,
    remind_at: null,
  },
];

export const DEMO_DAILY_METRICS = {
  metric_date: new Date().toISOString().split("T")[0],
  messages_scanned: 468,
  stacks_sent_to_ai: 21,
  alerts_sent: 1,
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
