

## אבחון ותוכנית תיקון — סנכרון משימות אנדרואיד ↔ דשבורד הורה

### מה מצאתי

**צד הווב תקין** — אין סינון לפי סטטוס, Realtime מוגדר, והממשק כבר מציג `completed_by_child` עם כפתורי אישור/דחייה.

**הבעיה בצד האנדרואיד** — המשימה עדיין `pending` ב-DB. ה-UPDATE מהאנדרואיד לא הגיע. הסיבות האפשריות:
- האנדרואיד לא משתמש ב-anon key (אלא authenticated או מפתח אחר)
- ה-UPDATE נכשל בשקט בגלל RLS ואין error handling
- בעיית רשת שלא מטופלת

### הפתרון: RPC `complete_chore` במקום UPDATE ישיר

במקום שהאנדרואיד יעשה UPDATE ישיר (שנכשל בשקט), ניצור RPC ייעודי שמחזיר תשובה ברורה עם success/error. זה:
1. עוקף RLS (SECURITY DEFINER) — עובד עם כל role
2. מחזיר JSON ברור — האנדרואיד יכול להציג הודעת שגיאה
3. מוודא שהסטטוס הנוכחי הוא `pending` — מונע updates כפולים

### שינויים

**1. Migration — RPC חדש `complete_chore(p_chore_id uuid)`**
```sql
CREATE FUNCTION complete_chore(p_chore_id uuid) 
RETURNS jsonb AS $$
  -- validates status = 'pending'
  -- updates to 'completed_by_child' + completed_at = now()
  -- returns { success: true } or { success: false, error: '...' }
$$ SECURITY DEFINER;
```

**2. `useChores.ts` — polling fallback**
הוספת `setInterval` כל 30 שניות שקורא ל-`fetchChores()` ו-`fetchRewardBank()` כגיבוי ל-Realtime.

**3. `ChoreList.tsx` — כפתור "סמן כבוצע" זמני**
כפתור קטן ליד כל משימה `pending` שקורא ל-`complete_chore` RPC — כדי לבדוק את כל הזרימה (complete → approve → bank) בלי תלות באנדרואיד.

### מה צריך לעדכן באנדרואיד

אחרי היישום, האנדרואיד צריך לעבור מ-UPDATE ישיר לקריאת RPC:
```kotlin
supabase.postgrest.rpc("complete_chore", mapOf("p_chore_id" to choreId))
```
זה יעבוד עם כל role (anon/authenticated) ויחזיר תשובה ברורה.

