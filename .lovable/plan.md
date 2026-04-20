

# הסתרת ניטור WhatsApp ב-UI בלבד (ללא פגיעה בקוד)

## הגישה
הוספת feature flag חדש `WHATSAPP_MONITORING_ENABLED = false` ב-`src/config/featureFlags.ts`. כל הקוד הקיים (טבלאות alerts, edge functions, hooks) נשאר בדיוק כמו שהוא — רק ה-UI מסתיר את כל מה שקשור לוואטסאפ/התראות/פרימיום. כשנרצה להחזיר — נשנה ל-`true` והכול חוזר.

## מה מוסתר כשהדגל כבוי

### 1. טאב "התראות" בניווט תחתון
**קובץ:** `src/components/BottomNavigationV2.tsx`
- סינון פריט "התראות" מתוך מערך הטאבים כשהדגל כבוי
- הניווט נשאר תקין (3 טאבים במקום 4)

### 2. ראוטים (לא חוסמים — רק לא מציגים CTA אליהם)
**קובץ:** `src/App.tsx`
- משאירים את הראוטים `/alerts-v2` ו-`/checkout` קיימים (למקרה גישה ישירה)
- לא נוגעים בלוגיקה

### 3. מסך הבית `/home-v2`
**קובץ:** `src/pages/HomeV2.tsx`
- הסתרת `<SmartProtectionSummary />` לחלוטין
- העברת `hasPremium={true}` קבוע ל-`FamilyStatusHero` כדי שלא יציג CTA לשדרוג
- ב-`AttentionSection` — סינון פריטי alerts (`unacknowledgedAlerts`) מהרשימה

**קובץ:** `src/components/home-v2/FamilyStatusHero.tsx`
- כשהדגל כבוי: לא להציג בכלל את ה-block של "שדרגו לפרימיום"
- להציג תמיד "הכול תקין כרגע" (ללא תלות ב-hasPremium)

### 4. כרטיס ילד `ChildCardV2`
**קובץ:** `src/components/home-v2/ChildCardV2.tsx`
- הסתרת badge של "התראות פתוחות" אם קיים
- הסתרת כל איזכור של פרימיום/Crown/שדרוג

### 5. מסך משפחה `/family-v2`
**קובץ:** `src/pages/FamilyV2.tsx`
- הסתרת כפתור/קישור "שדרוג לפרימיום"
- הכרטיס "פרימיום" כבר מוסתר כש-count=0 (נשאר כמו שהוא)

### 6. מסך הגדרות `/settings-v2`
**קובץ:** `src/pages/SettingsV2.tsx`
- הסתרת סקציית מנוי/שדרוג אם קיימת

### 7. מסך ילד `/child-v2/:id`
**קובץ:** `src/pages/ChildControlV2.tsx` ורכיבים נלווים
- הסתרת כל banner/CTA של "שדרגו לפרימיום לניטור WhatsApp"
- הסתרת `PremiumUpgradeCard` אם מוצג

### 8. מסך לנדינג (אופציונלי)
**קובץ:** `src/pages/Landing.tsx` ורכיבי landing
- אם יש סקציות שמדברות ספציפית על ניטור WhatsApp — להוסיף תנאי הסתרה
- (אם רוצים להשאיר לשיווק — אפשר לדלג)

## איך זה עובד טכנית
```typescript
// src/config/featureFlags.ts
export const WAITLIST_MODE = true;
export const WHATSAPP_MONITORING_ENABLED = false; // חדש
```

```typescript
// בכל מקום רלוונטי:
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";

{WHATSAPP_MONITORING_ENABLED && <SmartProtectionSummary ... />}
```

## יתרונות הגישה
1. **אפס שינוי בלוגיקה** — כל הקוד, ה-DB, ה-edge functions נשארים
2. **חזרה מיידית** — שינוי דגל אחד מחזיר את הכול
3. **ללא מיגרציות** — לא נוגעים ב-DB
4. **בטוח** — אפילו אם משתמש ינווט ידנית ל-`/alerts-v2` הוא יראה את המסך (פשוט אין כפתור)

## מה להבהיר לפני יישום
האם להסתיר גם את הראוטים `/alerts-v2` ו-`/checkout` לחלוטין (redirect ל-`/home-v2`), או רק להוריד את ה-CTAs ולהשאיר גישה ישירה? המלצתי: רק להוריד CTAs — בטוח יותר.

