

# תיקון קריסת `get_device_settings` — עמודה `last_updated` לא קיימת

## הבעיה
בשורה 172 של ה-RPC:
```sql
SELECT balance_minutes, last_updated INTO v_reward FROM reward_bank WHERE child_id = v_child_id;
```
הטבלה `reward_bank` **לא** מכילה עמודה בשם `last_updated`. העמודות בפועל הן: `id, child_id, balance_minutes, updated_at, current_streak, last_streak_date`.

לכן כל קריאה ל-`get_device_settings` קורסת עם `42703: column "last_updated" does not exist`, וזו הסיבה שהאנדרואיד לא מצליח לסנכרן אפילו אחרי תיקון ההרשאות.

בנוסף — `last_updated` נטען ל-`v_reward` אבל בכלל לא בשימוש בהמשך (רק `balance_minutes` מוחזר).

## התיקון (מיגרציה אחת קצרה)
להסיר את `last_updated` מה-SELECT:
```sql
SELECT balance_minutes INTO v_reward FROM reward_bank WHERE child_id = v_child_id;
```

זהו. שינוי של מילה אחת.

## אימות מיידי
בסוף המיגרציה אריץ:
```sql
SELECT public.get_device_settings('9d5a9132b033a86b');
```
ואוודא שמתקבל JSON תקין הכולל את `app_policies` עם Instagram כ-`blocked` + `daily_limit_minutes: -1`. אם הקריאה נכשלת — המיגרציה תיפול במקום להצליח באופן כוזב.

## תשובה לסוכן האנדרואיד אחרי התיקון
- ה-RPC מחזיר JSON תקין, ללא שגיאת 42703
- `app_policies` מכיל את כל האפליקציות החסומות + pending_block לאפליקציות חדשות
- `blocked_apps` (fallback) כולל את אותן אפליקציות
- ההרשאות (`anon`/`authenticated`) תקינות מהמיגרציה הקודמת

## מה לא משתנה
- אין שינוי בלוגיקה, בטריגרים, או ב-UI
- אין שינוי בקוד React
- רק תיקון שם עמודה אחד

