import type {
  CaseDomain,
  ConversationState,
  DeliveryState,
  FieldValueState,
  FreshnessStatus,
  MonitoringState,
  Priority,
  VerificationLevel,
} from "../domain/types";

export const priorityLabels: Record<Priority, string> = {
  S0: "קריטי",
  S1: "גבוה",
  S2: "בינוני",
  S3: "רגיל",
  UNKNOWN: "לא ידוע",
};

export const conversationStateLabels: Record<ConversationState, string> = {
  OPEN: "פתוחה",
  AI_ACTIVE: "בטיפול AI",
  TAKEOVER_REQUESTED: "ממתינה להעברה",
  WAITING_FOR_HUMAN: "ממתינה לנציג/ה",
  LEASE_OFFERED: "הקצאה מוצעת",
  HUMAN_ASSIGNED: "הוקצתה לנציג/ה",
  HUMAN_ACTIVE: "בטיפול אנושי",
  WAITING_CUSTOMER: "ממתינה ללקוח/ה",
  WAITING_INTERNAL: "ממתינה לצוות",
  RESOLVED: "נפתרה",
  CLOSED: "נסגרה",
  REOPENED: "נפתחה מחדש",
};

export const verificationLabels: Record<VerificationLevel, string> = {
  V0_UNKNOWN: "זהות לא אומתה",
  V1_CHANNEL_POSSESSION: "ערוץ אומת",
  V2_AUTHENTICATED_GUARDIAN: "Guardian מאומת/ת",
  V3_ACTION_BOUND_STEP_UP: "אימות מוגבר לפעולה",
};

export const domainLabels: Record<CaseDomain, string> = {
  PRE_SALES: "לפני רכישה",
  REGISTRATION: "רישום",
  INSTALLATION: "התקנה",
  PERMISSIONS: "הרשאות מכשיר",
  PARENTAL_CONTROLS: "בקרת הורים",
  MONITORING: "ניטור",
  BILLING: "חיוב",
  PRIVACY: "פרטיות",
  SECURITY: "אבטחה",
  CHILD_SAFETY: "בטיחות ילדים",
  COMPLAINT: "תלונה",
  PRODUCT_FEEDBACK: "משוב מוצר",
  LEGAL_MEDIA_PARTNER: "משפטי ושותפים",
  SPAM_ABUSE: "ספאם ושימוש לרעה",
};

export const valueStateLabels: Record<FieldValueState, string> = {
  AVAILABLE: "זמין",
  UNKNOWN: "לא ידוע",
  NOT_COLLECTED: "לא נאסף",
  NOT_SUPPORTED: "לא נתמך",
  SOURCE_UNAVAILABLE: "המקור אינו זמין",
  PERMISSION_DENIED: "אין הרשאה",
  PROHIBITED: "אסור להצגה",
};

export const freshnessLabels: Record<FreshnessStatus, string> = {
  FRESH: "עדכני",
  AGING: "מתיישן",
  STALE: "מיושן",
  UNKNOWN: "טריות לא ידועה",
  NOT_APPLICABLE: "לא רלוונטי",
};

export const monitoringLabels: Record<MonitoringState, string> = {
  AWAITING_FIRST_HEARTBEAT: "ממתין לדיווח ראשון",
  PROTECTED: "מוגן",
  DEGRADED: "חלקי",
  ACTION_REQUIRED: "נדרשת פעולה",
  HEARTBEAT_LATE: "דיווח מאחר",
  INTERRUPTED: "הניטור נקטע",
  RECOVERING: "בתהליך התאוששות",
  REVOKED: "בוטל",
};

export const deliveryLabels: Record<DeliveryState, string> = {
  PENDING: "ממתינה לשליחה",
  SENT: "נשלחה",
  DELIVERED: "נמסרה",
  READ: "נקראה",
  FAILED: "השליחה נכשלה",
  NOT_APPLICABLE: "לא רלוונטי",
};

export function formatFixtureTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export function stringifyFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "כן" : "לא";
  if (typeof value === "number") return new Intl.NumberFormat("he-IL").format(value);
  return String(value);
}
