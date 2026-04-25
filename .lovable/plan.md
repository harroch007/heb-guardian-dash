# תיקון: התראת "בעיית הרשאות" בטאב הבית

## הבעיה
בכרטיס של יריב (תוך ChildCardV2) הכל תקין כי `ProblemBanner` כבר מסונכרן עם `WHATSAPP_MONITORING_ENABLED=false`. אבל ב-`HomeV2.tsx` (טאב הבית) הלוגיקה שמחשבת `permissionIssues` עדיין סופרת **כל** הרשאה חסרה — כולל `accessibilityEnabled` ו-`notificationListenerEnabled` שאנחנו לא צריכים כרגע.

זה גורם ל:
- "🛡️ בעיית הרשאות" בכרטיס בטאב הבית
- "יריב: בעיית הרשאות" ב-AttentionSection ("דורש תשומת לב")

## התיקון
**קובץ יחיד:** `src/pages/HomeV2.tsx` (שורות ~157-176)

לייבא את `WHATSAPP_MONITORING_ENABLED` ולסנן את אותם 2 מפתחות הרשאה כשהפיצ'ר כבוי, בדיוק כמו ב-`ProblemBanner.tsx`:

```ts
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";

const WHATSAPP_PERMISSION_KEYS = ["accessibilityEnabled", "notificationListenerEnabled"];

// בתוך הלולאה:
const issues = Object.entries(perms)
  .filter(([k, v]) =>
    v === false &&
    (WHATSAPP_MONITORING_ENABLED || !WHATSAPP_PERMISSION_KEYS.includes(k))
  )
  .map(([k]) => k);
```

## תוצאה
- "בעיית הרשאות" תיעלם מכרטיס יריב בטאב הבית
- הפריט "יריב: בעיית הרשאות" יוסר מסקשן "דורש תשומת לב"
- כשנחזיר את ניטור וואטסאפ — הלוגיקה תחזור אוטומטית

## מה לא נוגעים
- אין שינוי ב-DB, RPC, או באנדרואיד
- אין שינוי ב-`ProblemBanner` (כבר תוקן)
- אין שינוי בלוגיקת התראות אחרות
