

## תוכנית: ממשק CRM לניהול לקוחות באדמין

### סקירת הפיצ'ר
כשלוחצים על שם משתמש ברשימת המשתמשים, נפתח דף פרופיל לקוח מלא עם יכולות ניהול: הערות, צפייה כהורה, מתן הטבות, ותיעוד כל פעולה שבוצעה.

### שינויי מסד נתונים (2 טבלאות חדשות)

#### 1. `admin_notes` — הערות שירות לקוחות
```
id             uuid PK
parent_id      uuid NOT NULL (ref parents.id)
admin_user_id  uuid NOT NULL (ref auth.users)
note_text      text NOT NULL
note_type      text DEFAULT 'general' (general / complaint / benefit / lock / other)
created_at     timestamptz DEFAULT now()
```
RLS: admins only (SELECT, INSERT, DELETE)

#### 2. `admin_activity_log` — לוג פעולות אדמין
```
id             uuid PK
admin_user_id  uuid NOT NULL
target_parent_id uuid NOT NULL
action_type    text NOT NULL (impersonate / add_note / grant_benefit / lock / unlock / edit_subscription)
action_details jsonb DEFAULT '{}'
created_at     timestamptz DEFAULT now()
```
RLS: admins only (SELECT, INSERT)

כל פעולה (כולל impersonation הקיים) תתועד כאן אוטומטית.

### שינויי קוד

#### 1. `src/pages/admin/AdminCustomerProfile.tsx` — קומפוננטה חדשה
דף פרופיל לקוח עם הסקשנים הבאים:

| סקשן | תוכן |
|---|---|
| כרטיס פרטים | שם, אימייל, טלפון, תאריך הרשמה, סטטוס מכשיר |
| ילדים ומכשירים | טבלה עם ילדים, מנוי (free/premium), תפוגה, מכשירים |
| פעולות מהירות | כפתורים: צפה כהורה, הענק חודש premium, נעל חשבון |
| הערות | רשימת הערות + טופס להוספת הערה חדשה |
| לוג פעולות | היסטוריית כל הפעולות שבוצעו על הלקוח |

פעולות זמינות:
- **צפה כהורה** — משתמש ב-impersonate הקיים + מתעד בלוג
- **הענק premium** — מעדכן `subscription_tier` ו-`subscription_expires_at` לכל הילדים + מתעד
- **הוסף הערה** — שומר ב-`admin_notes` + מתעד בלוג
- **נעל/שחרר חשבון** — (מוכן לעתיד, כרגע מסומן ב-UI)

#### 2. `src/pages/admin/AdminUsers.tsx` — שינוי
- שם המשתמש בטבלה הופך ללינק לחיץ
- לחיצה על השם פותחת את `AdminCustomerProfile` כ-Dialog/Sheet (או מוסיפה state)

#### 3. `src/pages/Admin.tsx` — שינוי קל
- שמירת `selectedUserId` ב-state
- העברתו ל-`AdminUsersHub` → `AdminUsers`
- כש-`selectedUserId` קיים, מציגים את `AdminCustomerProfile`

#### 4. תיעוד impersonation קיים
- ב-`handleImpersonate` הקיים ב-`AdminUsers.tsx`, מוסיפים INSERT ל-`admin_activity_log`

### ארכיטקטורה ויזואלית

```text
AdminUsers (טבלה)
  ├── לחיצה על שם → selectedUserId = user.id
  └── AdminCustomerProfile (Sheet/Dialog)
        ├── פרטי לקוח
        ├── ילדים + מנויים
        ├── [צפה כהורה] [הענק premium] [נעל]
        ├── הערות (+ הוספה)
        └── לוג פעולות
```

### קבצים שישתנו

| קובץ | שינוי |
|---|---|
| Migration | 2 טבלאות חדשות + RLS |
| `src/pages/admin/AdminCustomerProfile.tsx` | חדש — דף פרופיל לקוח |
| `src/pages/admin/AdminUsers.tsx` | שם לחיץ + תיעוד impersonation |
| `src/pages/admin/AdminUsersHub.tsx` | העברת state של selectedUser |
| `src/pages/Admin.tsx` | ניהול state של selectedUser |

### אבטחה
- כל הטבלאות עם RLS מוגבל לאדמינים בלבד (`is_admin()`)
- לוג הפעולות הוא append-only (INSERT בלבד, ללא DELETE/UPDATE)
- אין חשיפת מידע רגיש נוסף — משתמשים בנתונים שכבר זמינים לאדמין

