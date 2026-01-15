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

// Single alert for deep explanation view
export const DEMO_SINGLE_ALERT = {
  title: "שיח טעון בקבוצה חברתית",
  mainInsight: "במהלך שיחה קבוצתית היום, זוהה שיח טעון שכלל ביטויים פוגעניים.\n\nמההקשר הכללי עולה שרואי לא יזם את השיח, אלא הגיב לדברים שנאמרו על ידי אחרים.",
  socialContext: {
    participants: ["דניאל", "עומר"],
    note: "מדובר באינטראקציה חברתית, לא בשיחה פרטית."
  },
  patternInsight: "לא זוהו אירועים דומים בשיחות קודמות עם אותם משתתפים.\nנכון לעכשיו, אין אינדיקציה לדפוס מתמשך או להסלמה.",
  meaning: "מדובר באירוע נקודתי, אך כזה ששווה להיות מודעים אליו בהקשר חברתי.",
  parentalGuidance: "שיחה פתוחה ולא מאשימה עם רואי יכולה לעזור להבין איך הוא חווה את הדינמיקה החברתית בקבוצה."
};

// Legacy demo alerts (kept for compatibility)
export const DEMO_ALERTS = [
  {
    id: 1,
    child_id: "demo-child-1",
    child_name: "רואי",
    sender: "daniel123",
    sender_display: "דניאל",
    chat_name: "קבוצת הכיתה",
    chat_type: "group",
    parent_message: "זוהה שיח טעון בקבוצה חברתית שכלל ביטויים פוגעניים",
    suggested_action: "לשוחח עם הילד על התנהגות ברשת",
    category: "social",
    ai_risk_score: 75,
    ai_verdict: "review",
    ai_summary: "זוהה שיח טעון בקבוצה חברתית שכלל ביטויים פוגעניים",
    ai_recommendation: "מומלץ לשוחח עם הילד על הדינמיקה החברתית",
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
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
    parent_message: "זוהה שיח טעון בקבוצה חברתית שכלל ביטויים פוגעניים",
    sender_display: "דניאל",
    sender: "daniel123",
    category: "social",
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];
