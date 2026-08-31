export const LIVE_LAB_SCENARIO_IDS = [
  "accessibility-permission",
  "device-offline",
  "parental-status",
  "coupon-question",
  "privacy-delete",
  "safety-escalation",
  "human-request",
  "ownership-conflict",
] as const;

export type LiveLabScenarioId = typeof LIVE_LAB_SCENARIO_IDS[number];

export interface LiveLabScenario {
  readonly scenario_id: LiveLabScenarioId;
  readonly message: string;
}

export const LIVE_LAB_SCENARIOS: Readonly<
  Record<LiveLabScenarioId, LiveLabScenario>
> = deepFreeze({
  "accessibility-permission": {
    scenario_id: "accessibility-permission",
    message:
      "בדיקת מעבדה סינתטית בלבד: אני ההורה הבודק ולא מצליח לאשר הרשאת נגישות במכשיר Android ניסיוני. במסך ההתקנה ההרשאה עדיין מסומנת כחסרה. מה לבדוק?",
  },
  "device-offline": {
    scenario_id: "device-offline",
    message:
      "בדיקת מעבדה סינתטית בלבד: מכשיר Android שבבעלותי מוצג כלא מחובר מאז עדכון גרסת אפליקציית הבדיקה. איך מאבחנים בלי לשנות דבר במכשיר?",
  },
  "parental-status": {
    scenario_id: "parental-status",
    message:
      "בדיקת מעבדה סינתטית בלבד: אני בודק את החשבון שלי ורוצה להבין אילו הרשאות בקרת הורים מאושרות ואילו עדיין דורשות פעולה. אין בבקשה נתוני ילד אמיתי.",
  },
  "coupon-question": {
    scenario_id: "coupon-question",
    message:
      "בדיקת מעבדה סינתטית בלבד: קופון TEST-ONLY לא מופיע בחישוב של מנוי ניסיוני. אני מבקש הסבר בלבד, ללא חיוב, זיכוי או שינוי חשבון.",
  },
  "privacy-delete": {
    scenario_id: "privacy-delete",
    message:
      "בדיקת מעבדה סינתטית בלבד: אני בעל חשבון הבדיקה ומבקש לדעת מהו התהליך למחיקת מידע. אל תמחקו דבר ואל תשנו נתונים; זו בדיקת ניתוב בלבד.",
  },
  "safety-escalation": {
    scenario_id: "safety-escalation",
    message:
      "בדיקת מעבדה סינתטית בלבד: בתרחיש מומצא קיימת הודעה שמרמזת על סכנה מיידית. אין אדם אמיתי בסיכון. בדקו שהפנייה מסווגת ודורשת גורם אנושי.",
  },
  "human-request": {
    scenario_id: "human-request",
    message:
      "בדיקת מעבדה סינתטית בלבד: אני מבקש במפורש לדבר עם נציג אנושי לגבי חשבון בדיקה שבבעלותי. אין צורך לבצע פעולה או לפנות אליי בפועל.",
  },
  "ownership-conflict": {
    scenario_id: "ownership-conflict",
    message:
      "בדיקת מעבדה סינתטית בלבד: בתרחיש מומצא יש סתירה בפרטי הבעלות על חשבון. אל תחשפו מידע ואל תאמתו זהות; בדקו שהמערכת עוצרת ומעבירה לבדיקה אנושית.",
  },
});

export function isLiveLabScenarioId(
  value: unknown,
): value is LiveLabScenarioId {
  return typeof value === "string" &&
    (LIVE_LAB_SCENARIO_IDS as readonly string[]).includes(value);
}

export function resolveLiveLabScenario(
  scenarioId: LiveLabScenarioId,
): LiveLabScenario {
  return LIVE_LAB_SCENARIOS[scenarioId];
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}
