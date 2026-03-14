

## תוכנית: הוספת `always_allowed` לאפליקציות + הסתרתן מהממשק

### הבעיה
אין הבחנה בין אפליקציה "מאושרת" (כפופה למגבלת זמן מסך) לבין "תמיד פתוחה". ההורה רואה 40 אפליקציות ברשימה כולל אפליקציות מערכת שאין טעם לנהל.

### גישה
אפליקציות "תמיד פתוחות" = לא נחסמות לעולם + **מוסתרות לחלוטין מממשק ההורה**. רק הסוכן צריך לדעת עליהן.

### שינויים

**1. מיגרציה — עמודה חדשה ב-`app_policies`**
```sql
ALTER TABLE app_policies ADD COLUMN always_allowed boolean NOT NULL DEFAULT false;
```

**2. עדכון נתונים (insert tool) — סימון 28 האפליקציות מהרשימה**
```sql
UPDATE app_policies SET always_allowed = true
WHERE child_id = '6233e88a-0212-4682-a350-442681e95a5f'
  AND package_name IN ('com.google.android.apps.docs', 'com.microsoft.office.excel', ...);
```

**3. עדכון RPC `get_device_settings`** — הוספת `always_allowed` לכל policy object:
```sql
jsonb_build_object(
  'package_name', ap.package_name,
  'policy_status', CASE WHEN ap.is_blocked THEN 'blocked' ELSE 'approved' END,
  'daily_limit_minutes', null,
  'always_allowed', ap.always_allowed
)
```

**4. עדכון טיפוס `AppPolicy`** ב-`useChildControls.ts` — הוספת `always_allowed: boolean`

**5. סינון בממשק — 2 קבצים**
- **`AppsSection.tsx`** — סינון `appPolicies.filter(p => !p.always_allowed)` לפני העברה ל-`AppControlsList`, וכן סינון `installedApps` בהתאם. כך אפליקציות "תמיד פתוחות" לא מופיעות כלל
- **`AppControlsList.tsx`** — ללא שינוי (הנתונים כבר מסוננים מבחוץ)

### תוצאה
- ההורה רואה רק אפליקציות שהוא יכול לנהל (חסום/פתח)
- הסוכן מקבל `always_allowed: true` ויודע בוודאות לא לחסום אותן
- אפליקציות מערכת שכבר מסוננות ב-`isSystemApp` ממשיכות להיות מוסתרות כרגיל

