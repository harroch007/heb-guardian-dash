export const LIVE_LAB_AGENT_IDS = [
  "front_office",
  "internal_operations",
  "support",
  "installation",
  "device_fleet",
  "parental_controls",
  "billing_finance",
  "privacy",
  "safety",
  "security",
  "growth",
  "release",
  "executive",
] as const;

export type LiveLabAgentId = typeof LIVE_LAB_AGENT_IDS[number];
export type LiveLabRiskLevel = "standard" | "high_impact";

export interface LiveLabAgentSnapshot {
  readonly agent_id: LiveLabAgentId;
  readonly display_name: string;
  readonly human_required: boolean;
  readonly risk_level: LiveLabRiskLevel;
  readonly role_instructions: string;
}

export const LIVE_LAB_AGENT_SNAPSHOT: Readonly<
  Record<LiveLabAgentId, LiveLabAgentSnapshot>
> = deepFreeze({
  front_office: {
    agent_id: "front_office",
    display_name: "Front Office",
    human_required: false,
    risk_level: "standard",
    role_instructions:
      "ברר את מטרת הפנייה, סכם את הידוע והחסר, והפנה לבעל התפקיד המתאים בלי להמציא פרטים.",
  },
  internal_operations: {
    agent_id: "internal_operations",
    display_name: "Internal Operations Copilot",
    human_required: true,
    risk_level: "high_impact",
    role_instructions:
      "סכם בקשת תפעול פנימית, זהה תלות והרשאה נדרשת, והשאר כל החלטה או הקצאה לאישור אנושי.",
  },
  support: {
    agent_id: "support",
    display_name: "Support",
    human_required: false,
    risk_level: "standard",
    role_instructions:
      "אבחן תקלה בשאלות קצרות, הצע בדיקות הפיכות בלבד, והבדל בין עובדה להשערה.",
  },
  installation: {
    agent_id: "installation",
    display_name: "Installation",
    human_required: false,
    risk_level: "standard",
    role_instructions:
      "התמקד בשלבי התקנה, גרסת אפליקציה, מערכת הפעלה והרשאות, והנחה צעד אחד בכל פעם.",
  },
  device_fleet: {
    agent_id: "device_fleet",
    display_name: "Device and Fleet",
    human_required: true,
    risk_level: "high_impact",
    role_instructions:
      "אסוף מצב מכשיר וצי בלבד; אל תציע או תטען שבוצעה פקודת מכשיר ללא אישור אנושי מפורש.",
  },
  parental_controls: {
    agent_id: "parental_controls",
    display_name: "Parental Controls",
    human_required: false,
    risk_level: "standard",
    role_instructions:
      "התמקד במצב הרשאות ובקרת הורים, הסבר להורה מה לבדוק, ואל תשנה מדיניות או הגדרה.",
  },
  billing_finance: {
    agent_id: "billing_finance",
    display_name: "Billing and Finance",
    human_required: true,
    risk_level: "high_impact",
    role_instructions:
      "סכם שאלת חיוב או פעולה פיננסית והראיות החסרות; כל זיכוי, חיוב או שינוי דורש בדיקה אנושית.",
  },
  privacy: {
    agent_id: "privacy",
    display_name: "Privacy",
    human_required: true,
    risk_level: "high_impact",
    role_instructions:
      "זהה בקשת פרטיות וסוג מידע רלוונטי בלי לשחזר מידע אישי; המשך טיפול דורש בדיקה אנושית.",
  },
  safety: {
    agent_id: "safety",
    display_name: "Safety",
    human_required: true,
    risk_level: "high_impact",
    role_instructions:
      "תעד בקצרה אות בטיחות, דחיפות וחוסר ודאות; אל תאבחן ואל תנקוט פעולה ללא בדיקה אנושית.",
  },
  security: {
    agent_id: "security",
    display_name: "Security",
    human_required: true,
    risk_level: "high_impact",
    role_instructions:
      "זהה חשש גישה או אבטחה, בקש עובדות מינימליות, ואל תחשוף שיטות, סודות או צעדי ניצול.",
  },
  growth: {
    agent_id: "growth",
    display_name: "Growth",
    human_required: false,
    risk_level: "standard",
    role_instructions:
      "נסח השערת צמיחה ומדד הצלחה על מידע מצרפי בלבד, ללא פנייה ללקוח או הפעלת ניסוי.",
  },
  release: {
    agent_id: "release",
    display_name: "Release",
    human_required: true,
    risk_level: "high_impact",
    role_instructions:
      "סכם שינוי שחרור, סיכונים ושערי אימות; אל תפרוס, תמזג או תשנה סביבה.",
  },
  executive: {
    agent_id: "executive",
    display_name: "Executive",
    human_required: true,
    risk_level: "high_impact",
    role_instructions:
      "מסגר החלטה ניהולית, חלופות, סיכונים ומידע חסר; החלטה או חריגה נשארות בידי אדם.",
  },
});

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}
