

## תוכנית: שדרוג AdminCustomerProfile — עריכה, מחיקה, ופרטי ילד מורחבים

### הבעיות הנוכחיות

1. **"ילדים ומנויים"** — מציג שם, מגדר, תאריך לידה, מנוי, מכשירים — אבל אין אפשרות לערוך, אין מספר טלפון של הילד, ואין פרטים מלאים
2. **WhatsApp מכובה** — כי `user.phone` הוא `null` (ללקוח אין טלפון רשום ב-parents). הכפתור disabled כי `disabled={!user.phone}`
3. **"נעל חשבון"** — מוגדר כ-`disabled` עם הכיתוב "בקרוב" כי עדיין לא מומש
4. **אין עריכת פרטי לקוח** — לא ניתן לשנות שם/טלפון/אימייל מתוך הפרופיל
5. **אין מחיקת משתמש** — אין כפתור מחיקה לאדמין

### שינויים מתוכננים

#### 1. `src/pages/admin/AdminCustomerProfile.tsx` — שינויים מרכזיים

**כרטיס פרטי לקוח — מצב עריכה:**
- הוספת כפתור "ערוך" שמעביר למצב עריכה inline
- שדות ניתנים לעריכה: שם מלא, טלפון
- שמירה ב-`parents` table (אדמין כבר יש לו RLS ל-SELECT, צריך להוסיף UPDATE)

**כרטיס ילדים — הרחבה:**
- הצגת מספר טלפון של הילד (`phone_number` — כבר קיים ב-DB)
- הוספת כפתור עריכה לכל ילד: שם, תאריך לידה, מגדר, מספר טלפון
- עריכה inline בתוך הכרטיס

**כפתור WhatsApp — תיקון:**
- כשאין טלפון הורה, נסה להשתמש בטלפון הילד אם קיים
- הוסף tooltip שמסביר למה מכובה (אין טלפון כלל)

**נעילת חשבון — הפעלה:**
- הוספת עמודה `is_locked` ל-`parents` (migration)
- כפתור נעל/שחרר שמעדכן את השדה + מתעד בלוג
- ב-AuthContext — בדיקה אם ההורה נעול ומניעת כניסה

**מחיקת משתמש:**
- כפתור "מחק משתמש" בצבע אדום בתחתית הפרופיל
- דיאלוג אישור עם הקלדת שם המשתמש
- מחיקת: alerts, app_usage, devices, children, admin_notes, admin_activity_log, parents
- שימוש ב-service role דרך edge function חדשה `admin-delete-user`

#### 2. Migration — שינויי DB

```sql
-- הוספת עמודת נעילה ל-parents
ALTER TABLE parents ADD COLUMN is_locked boolean DEFAULT false;

-- RLS: אדמין יכול לעדכן parents
CREATE POLICY "Admins can update parents" ON parents
  FOR UPDATE USING (is_admin());
```

#### 3. Edge Function חדשה: `supabase/functions/admin-delete-user/index.ts`
- מאמתת שהקורא הוא אדמין
- מקבלת `userId`
- מוחקת לפי סדר תלויות: alerts → app_usage → nightly_usage_reports → app_alerts → device_events → settings → devices → children → admin_notes → admin_activity_log → push_subscriptions → parents
- מוחקת את המשתמש מ-auth.users דרך `serviceClient.auth.admin.deleteUser()`
- מתעדת בלוג לפני המחיקה

#### 4. שינוי ב-AuthContext (בדיקת נעילה)
- אחרי login, בדיקה אם `parents.is_locked === true`
- אם כן → logout + הודעת שגיאה "החשבון שלך נעול, פנה לתמיכה"

### קבצים שישתנו

| קובץ | שינוי |
|---|---|
| Migration | `is_locked` ב-parents + RLS update לאדמין |
| `src/pages/admin/AdminCustomerProfile.tsx` | עריכת פרטי הורה, עריכת פרטי ילד, טלפון ילד, נעילה, מחיקה |
| `supabase/functions/admin-delete-user/index.ts` | חדש — מחיקת משתמש מלאה |
| `supabase/config.toml` | הוספת admin-delete-user עם verify_jwt=false |
| `src/contexts/AuthContext.tsx` | בדיקת is_locked |
| `src/integrations/supabase/types.ts` | עדכון types ל-parents.is_locked |

### אבטחה
- Edge function מחיקה דורשת אימות אדמין (is_admin via RPC)
- נעילה מונעת login — לא רק UI
- כל פעולת עריכה/מחיקה מתועדת ב-admin_activity_log

