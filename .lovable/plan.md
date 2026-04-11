

# הבאג שנמצא: RLS Nesting — `device_commands` policies fail silently for anon

## הבעיה בדיוק

ה-RLS policies שיצרנו על `device_commands` עבור `anon` משתמשות ב-subquery:

```sql
EXISTS (
  SELECT 1 FROM devices
  WHERE devices.device_id = device_commands.device_id
  AND devices.child_id IS NOT NULL
)
```

**הבעיה:** כשה-`anon` role מריץ את ה-subquery הזה, Supabase מפעיל גם את ה-RLS של טבלת `devices`. ולטבלת `devices` אין שום policy שמאפשרת ל-`anon` לקרוא שורות:

- `"Parents can view their children devices"` → דורש `is_family_parent(child_id)` → קורא ל-`auth.uid()` → **NULL עבור anon** → מחזיר false
- `"Admins can view all devices"` → דורש `authenticated` role → **anon לא עובר**

**תוצאה:** ה-`EXISTS` תמיד מחזיר `false` עבור anon. לכן אפליקציית האנדרואיד (שמשתמשת ב-anon key) **לא יכולה לקרוא שום פקודה** מ-`device_commands`, למרות שה-policy נראית תקינה.

זו גם הסיבה ש-RPCs כמו `update_device_status` עובדים — הם `SECURITY DEFINER` ומדלגים על RLS.

## הפתרון

יצירת פונקציית SECURITY DEFINER שבודקת אם device_id מזווג לילד, ושימוש בה ב-policies במקום ה-subquery הישיר:

```sql
-- 1. Helper function (bypasses RLS on devices table)
CREATE OR REPLACE FUNCTION public.is_paired_device(p_device_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.devices
    WHERE device_id = p_device_id
    AND child_id IS NOT NULL
  );
$$;

-- 2. Drop the broken policies
DROP POLICY "Devices can read commands (legacy fallback)" ON public.device_commands;
DROP POLICY "Devices can update commands (legacy fallback)" ON public.device_commands;

-- 3. Recreate with the helper function
CREATE POLICY "Devices can read commands (legacy fallback)"
ON public.device_commands FOR SELECT TO anon
USING (public.is_paired_device(device_id));

CREATE POLICY "Devices can update commands (legacy fallback)"
ON public.device_commands FOR UPDATE TO anon
USING (public.is_paired_device(device_id));
```

## למה זה יעבוד

- `is_paired_device()` היא SECURITY DEFINER — היא רצה עם ההרשאות של ה-owner (postgres), ולכן מדלגת על RLS של `devices`
- אותו pattern בדיוק שבו אנחנו משתמשים ב-`is_family_parent()`, `is_admin()`, וכל שאר ה-helper functions
- אין שינוי בצד הדשבורד או באנדרואיד — רק תיקון של ה-policy

## מה זה יתקן

| פיצ'ר | לפני | אחרי |
|---|---|---|
| Ring Device | ❌ command נשאר PENDING | ✅ אנדרואיד יקרא ויעדכן |
| Locate Now | ❌ command נשאר PENDING | ✅ אנדרואיד יקרא ויבצע |
| Refresh Settings | ❌ command נשאר PENDING | ✅ אנדרואיד יקרא |
| Report Heartbeat (on-demand) | ❌ command נשאר PENDING | ✅ אנדרואיד יקרא |

## שינויים נדרשים

1. **מיגרציה אחת בלבד** — יצירת הפונקציה + החלפת 2 policies
2. **אפס שינויים בקוד הדשבורד**
3. **אפס שינויים באנדרואיד**

