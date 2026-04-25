
# הסתרת התראות הרשאות WhatsApp בכרטיס הילד

## הבעיה
`ProblemBanner` (שמופיע בכרטיס הילד בדשבורד) עדיין סופר את `accessibilityEnabled` ו-`notificationListenerEnabled` כ"הרשאות חסרות" ומציג באנר אדום:
> "1 הרשאות חסרות במכשיר — חסר: האזנה להתראות"

זה לא רלוונטי כי `WHATSAPP_MONITORING_ENABLED = false` — אנחנו לא מנטרים WhatsApp עד הודעה חדשה. ב-`DeviceHealthBanner` כבר עשינו את הסינון הזה (דרך `WHATSAPP_PERMISSION_KEYS`), אבל ב-`ProblemBanner` שכחנו.

## השינוי

### `src/components/child-dashboard/ProblemBanner.tsx`
1. ייבוא `WHATSAPP_MONITORING_ENABLED` מ-`@/config/featureFlags`.
2. הגדרת קבוע `WHATSAPP_PERMISSION_KEYS = ["accessibilityEnabled", "notificationListenerEnabled"]`.
3. בסינון `missingPerms` — לדלג על המפתחות הללו כש-`WHATSAPP_MONITORING_ENABLED === false`.
4. בלוק "ניטור הודעות לקוי" — להציג רק כש-`WHATSAPP_MONITORING_ENABLED === true`.

```ts
const missingPerms = Object.entries(deviceHealth.permissions).filter(
  ([key, val]) =>
    val === false &&
    (WHATSAPP_MONITORING_ENABLED || !WHATSAPP_PERMISSION_KEYS.includes(key))
);
```

## תוצאה
- הבאנר האדום בכרטיס של יריב ייעלם (אם רק `notificationListenerEnabled` חסרה).
- כשנחזיר ניטור WhatsApp בעתיד (`WHATSAPP_MONITORING_ENABLED = true`) — ההתראות יחזרו אוטומטית בלי שינויי קוד נוספים.
- עקביות מלאה עם `DeviceHealthBanner` שכבר עושה את אותו דבר.

## מה לא נוגעים
- אין שינוי ב-DB, RPCs, או באנדרואיד.
- אין שינוי ב-`DeviceHealthBanner` (כבר מטופל).
- ה-`PERMISSION_LABELS` ב-`ChildControlV2.tsx` לא בשימוש פעיל — לא נוגעים.

## קובץ שיתעדכן
- `src/components/child-dashboard/ProblemBanner.tsx`
