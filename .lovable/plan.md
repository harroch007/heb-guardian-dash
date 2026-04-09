

## תיקון שגיאת `update_device_status` (PGRST203)

### מה קורה עכשיו
יש 3 גרסאות של הפונקציה `update_device_status` בדאטאבייס. כשהאפליקציה שולחת 4 פרמטרים, PostgREST לא יודע לבחור בין הגרסה עם 4 פרמטרים בדיוק לבין הגרסה עם 6 פרמטרים (שיש לה 2 defaults) — ולכן נכשל.

### מה צריך לקרות
מיגרציה אחת שמוחקת את 2 הגרסאות הישנות (shims) ומשאירה רק את הגרסה הראשית עם 6 פרמטרים. הגרסה הזו כבר כוללת `DEFAULT NULL` לשני הפרמטרים האחרונים, כך שקריאות עם 4 פרמטרים ימשיכו לעבוד.

### מיגרציה
```sql
DROP FUNCTION public.update_device_status(text, integer);
DROP FUNCTION public.update_device_status(text, integer, double precision, double precision);
```

### שינויי קוד
אין — הדשבורד לא קורא ישירות לפונקציה הזו. רק האנדרואיד משתמש בה.

