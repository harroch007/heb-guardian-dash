

## אבחון מדויק מהנתונים

**עובדות מה-DB:**
- 7+ פקודות REPORT_HEARTBEAT — **כולן COMPLETED** (המכשיר קיבל ועיבד)
- רק **3 heartbeats** נכתבו ל-DB (כולן מ-07:49-07:54, לפני שביטלת את הרשאת המיקום)
- **אפס** התראות system נוצרו למכשיר

**מה קרה:**
- Heartbeat #1: location=false, #2: location=true, #3: location=true — **אין שינוי הרשאות שלילי → הכל עבד**
- מ-heartbeat #4 ואילך: ביטלת location, הטריגר `on_heartbeat_insert` מזהה שינוי true→false, מנסה ליצור התראה → **ההתראה לא נוצרה = הטריגר נכשל = ה-INSERT של ה-heartbeat עצמו מתבטל (rollback)**

### שורש הבעיה

הטריגר `on_heartbeat_insert` מנסה ליצור alert כשהרשאה מתבטלת. ה-INSERT של ה-alert מפעיל טריגרים נוספים (`enqueue_ai_analyze_on_alert_insert`, `trigger_analyze_alert`). אם **אחד מהם נכשל**, כל השרשרת מתבטלת — כולל ה-heartbeat המקורי.

התוצאה: ה-heartbeat נבלע בשקט, ה-polling לא מוצא כלום, וקופצת השגיאה "המכשיר לא הגיב".

### התיקון

עטיפת חלק ההשוואה והיצירה של אלרטים ב-`on_heartbeat_insert` בבלוק `BEGIN...EXCEPTION`, כך שכשלון ביצירת אלרט **לא ימנע** את שמירת ה-heartbeat:

```sql
-- בתוך on_heartbeat_insert, עטיפת הלולאה:
BEGIN
  FOR v_perm_key IN SELECT jsonb_object_keys(v_perm_labels) LOOP
    -- ... permission comparison and alert creation ...
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'on_heartbeat_insert: alert creation failed err=%', SQLERRM;
END;
```

**שינוי אחד בלבד** — migration שמחליפה את הפונקציה `on_heartbeat_insert` עם הגנת EXCEPTION סביב יצירת האלרטים. ה-heartbeat תמיד יישמר, גם אם ההתראה נכשלת.

### פרטים טכניים

- הקוד הקיים כבר עוטף את ה-push notification ב-EXCEPTION
- צריך להרחיב את ההגנה לכל הלולאה (השוואת הרשאות + INSERT alert)
- שום שינוי בצד הלקוח — הבעיה היא 100% בטריגר בצד ה-DB
- ה-UPDATE של metadata (device_model, last_seen) נשאר מחוץ ל-EXCEPTION כי הוא לא אמור להיכשל

