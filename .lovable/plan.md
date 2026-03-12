

## פיצ'ר: מטלות ותגמולים (Chores & Rewards)

### סקירת הרעיון + הצעות שיפור

הרעיון מצוין לריטנשן. הנה כמה הצעות:

1. **בנק דקות מצטבר (לא רק יומי)** — דקות שנצברו ולא נוצלו עוברות ליום הבא. זה מגדיל מוטיבציה.
2. **משימות חוזרות** — אפשרות לסמן משימה כ"יומית" (למשל "לסדר חדר" כל יום) כך שההורה לא צריך ליצור מחדש.
3. **סטטוס ויזואלי ברור** — הילד רואה Progress bar של "הרווחת 45 דק' מתוך שימוש יומי של 120 דק'" + כמה נשאר בבנק.
4. **היסטוריה קצרה** — הילד רואה את המשימות שביצע אתמול/השבוע (מוטיבציה).

### ארכיטקטורת נתונים (Supabase)

**טבלה חדשה: `chores`**
```
id              uuid PK
child_id        uuid FK → children
parent_id       uuid FK → parents (auth.uid)
title           text (תיאור המשימה)
reward_minutes  integer (דקות תגמול)
is_recurring    boolean default false
recurrence_days integer[] (ימים בשבוע, null = חד פעמי)
status          text default 'pending' (pending | completed_by_child | approved | rejected)
completed_at    timestamptz
approved_at     timestamptz
created_at      timestamptz default now()
```

**טבלה חדשה: `reward_bank`**
```
id              uuid PK
child_id        uuid FK → children (UNIQUE)
balance_minutes integer default 0
updated_at      timestamptz default now()
```

**טבלה חדשה: `reward_transactions`**
```
id              uuid PK
child_id        uuid FK → children
amount_minutes  integer (חיובי = הרוויח, שלילי = ניצל)
source          text ('chore_approved' | 'bank_redeem')
chore_id        uuid FK → chores (nullable)
created_at      timestamptz default now()
```

**RLS:**
- הורים: CRUD על chores של הילדים שלהם, SELECT על reward_bank ו-reward_transactions
- INSERT על reward_transactions (לאישור משימות)
- אנדרואיד (anon): SELECT על chores + reward_bank, UPDATE סטטוס ל-`completed_by_child`, INSERT ל-reward_transactions עם source=`bank_redeem`

**RPC חדש: `approve_chore(p_chore_id uuid)`**
- Security definer
- מעדכן chore.status → approved
- מוסיף שורה ל-reward_transactions
- מעדכן reward_bank.balance_minutes

**RPC חדש: `redeem_reward_minutes(p_child_id uuid, p_minutes integer)`**
- Security definer (נקרא מהאנדרואיד)
- בודק שיש מספיק balance
- מוסיף ל-bonus_time_grants (כדי שה-`get_device_settings` יחזיר את הדקות הנוספות)
- מוריד מ-reward_bank
- מוסיף שורה ל-reward_transactions

**Real-time:** טבלת `chores` ו-`reward_bank` עם Realtime enabled — האנדרואיד מאזין לשינויים.

### מה האנדרואיד צריך לממש

**API/נתונים שהאנדרואיד צורך:**
1. `SELECT * FROM chores WHERE child_id = ? AND status = 'pending'` — רשימת משימות פתוחות
2. `SELECT balance_minutes FROM reward_bank WHERE child_id = ?` — יתרת בנק
3. `UPDATE chores SET status = 'completed_by_child', completed_at = now() WHERE id = ?` — סימון "בוצע"
4. `RPC redeem_reward_minutes(child_id, minutes)` — פדיון דקות מהבנק
5. Realtime subscription על `chores` ו-`reward_bank` לעדכונים חיים

**מסך באנדרואיד (תיאור לסוכן):**
- סטטוס עליון: "נותרו לך X דקות שימוש | בנק: Y דקות"
- כשהמכשיר נחסם (הגעה למגבלה): כפתורים "השתמש 15ד׳ / 30ד׳ / 45ד׳" מתוך הבנק
- רשימת משימות pending עם כפתור "ביצעתי ✓"
- הודעה "ממתין לאישור ההורה" כשסטטוס = completed_by_child

### מה אנחנו בונים (Web)

**1. טאב חדש בניווט: "משימות" (ClipboardList icon)**
- בין "משפחה" ל"התראות" בתפריט

**2. דף `/chores` — ניהול משימות**
- בחירת ילד (אם יש יותר מאחד, ברירת מחדל = הראשון)
- טופס הוספת משימה: כותרת + דקות תגמול + (אופציונלי) חוזרת/ימים
- רשימת משימות עם סטטוס:
  - 🟡 pending — ממתינה לביצוע
  - 🟠 completed_by_child — הילד סימן "בוצע", כפתור "אשר ✓" / "דחה ✗" להורה
  - 🟢 approved — בוצע ואושר
- תצוגת יתרת בנק הדקות של הילד הנבחר
- Push notification להורה כשילד מסמן "בוצע" (בעתיד)

**3. קבצים חדשים:**
- `src/pages/Chores.tsx` — דף ראשי
- `src/components/chores/ChoreForm.tsx` — טופס הוספה
- `src/components/chores/ChoreList.tsx` — רשימת משימות
- `src/components/chores/RewardBankCard.tsx` — כרטיס יתרת בנק
- `src/hooks/useChores.ts` — לוגיקת data + realtime

**4. עדכון ניווט:**
- `BottomNavigation.tsx` — הוספת טאב "משימות" (5 טאבים, אייקון ClipboardList)
- `AppSidebar.tsx` — הוספת פריט "משימות"
- `App.tsx` — route חדש `/chores`

**5. Migration:**
- יצירת 3 טבלאות + RLS + 2 RPCs

### סדר יישום
1. Migration: טבלאות + RLS + RPCs
2. Hook: `useChores.ts` עם realtime
3. דף Chores + קומפוננטות
4. עדכון ניווט + routing

