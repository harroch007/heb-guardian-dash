## הבנתי את המשימה

שדרוג חוויית ההורה ב-V2 ב-3 פיצ'רים, ללא שינויי DB. אני אשתמש ברכיבים הקיימים (Card / Button / Badge / shadcn) ובסכמת `chores` הקיימת + `useChores`.

---

### 1. תבניות משימות מהירות (1-Click Templates)

**קובץ חדש:** `src/components/chores/QuickChoreTemplates.tsx`

- שורת צ'יפים גלילה אופקית (RTL) עם 4 תבניות:
  - "סדר את החדר" · 15 דק׳
  - "שיעורי בית" · 20 דק׳
  - "כלים למדיח" · 10 דק׳
  - "התארגנות בוקר" · 5 דק׳
- כל צ'יפ → `onPick(title, minutes)` קריאה ל-`addChore(title, minutes, false, null)` מיידית (יצירה בקליק, כפי שהומלץ).
- toast אישור (כבר קיים ב-`addChore`).
- אופציונלי: בלחיצה ארוכה / כפתור קטן ליד — מילוי הטופס בלבד במקום יצירה. נשאיר רק "יצירה מיידית" לפשטות.

**אינטגרציה:** ב-`ChoresV2.tsx` באקורדיון "הוסף משימה חדשה" — מעל ה-`<ChoreForm>`. נציג את הצ'יפים גם כשהאקורדיון סגור? לא — נשאר בתוך האקורדיון כדי לא להעמיס. במקום זאת, נחשוף שורה דקה אחת של הצ'יפים גם בראש העמוד מתחת לסיכום, כדי שהקליק האחד באמת יהיה אחד.

---

### 2. שיקוף Streak (רצף ימים)

**קובץ חדש:** `src/lib/streak.ts`

```ts
export function calcStreak(approvedChores: {completed_at|approved_at}[], tz='Asia/Jerusalem'): number
```

- ממיר completed_at של משימות במצב `approved` לתאריך ישראלי (YYYY-MM-DD), Set ייחודי.
- מתחיל מהיום; אם אין היום → מתחיל מאתמול (כדי לא לאפס לפני סוף יום).
- אם גם אין אתמול → 0.
- אחרת סופר ימים רצופים אחורה.
- זהה ללוגיקת האנדרואיד.

**הרחבת `HomeV2.tsx`:**

- בשאילתת `chores` הקיימת כבר מושכים `status, completed_at` עבור `["completed_by_child","approved"]`. נסנן ל-`approved` ונחשב `streak` per child.
- נוסיף שדה `streak: number` ל-`ChildWithData`.

**תצוגה:** ב-`ChildCardV2.tsx` — בולטה קטנה ליד שם הילד:

- אם `streak >= 1`: `<Badge>🔥 {streak} ימים ברצף</Badge>` בצבע orange/warning.
- אם 0 — לא מציגים.

---

### 3. באנר Anti-Churn

**קובץ חדש:** `src/components/home-v2/StreakNudgeBanner.tsx`

- props: `childrenData: ChildWithData[]`, `onAddChore(childId)`.
- לוגיקה: עבור כל ילד בודקים `streak >= 2` AND אין משימה פתוחה (`status=pending`) ל-היום/מחר.
  - "משימה להיום/מחר" = chore עם `status='pending'` כאשר:
    - לא חוזרת → תמיד נחשבת פתוחה.
    - חוזרת → `recurrence_days` כולל את היום (1-7 ISO) או מחר.
- נצטרך להרחיב את שאילתת `chores` ב-HomeV2 לכלול גם `pending` עם `is_recurring, recurrence_days, id`.
- אם נמצא ילד אחד או יותר שעונה על התנאי — מציג באנר חם בראש העמוד:
  > "ל{name} יש רצף של {streak} ימים 🔥 אל תיתן לזה להישבר — הוסף משימה להיום"
  >  [+ הוסף משימה מהירה]
- כפתור פותח Sheet/Dialog קטן עם אותם 4 צ'יפים מ-#1 (שימוש חוזר ב-`QuickChoreTemplates`), בחירת ילד אם מרובה.
- אם יש כמה ילדים מתאימים → באנר אחד עם carousel קטן או שילוב שמות ("לדני ולנועה...").

**מיקום:** `HomeV2.tsx` מעל `FamilyStatusHero` (כדי שיראה ראשון).

---

### קבצים שיושפעו

- חדש: `src/components/chores/QuickChoreTemplates.tsx`
- חדש: `src/lib/streak.ts`
- חדש: `src/components/home-v2/StreakNudgeBanner.tsx`
- עריכה: `src/pages/ChoresV2.tsx` (שילוב הצ'יפים)
- עריכה: `src/components/chores/ChoreForm.tsx` (תמיכה ב-prop `prefill?: {title, minutes}`)
- עריכה: `src/pages/HomeV2.tsx` (חישוב streak + שאילתה מורחבת + באנר)
- עריכה: `src/components/home-v2/ChildCardV2.tsx` (Badge רצף)

ללא שינויי DB / RLS / Edge Functions. שימוש ב-`addChore` הקיים, `useChores`, רכיבי shadcn קיימים, צבעים סמנטיים (warning/primary).  
  
התוכנית מצוינת – מאושר לביצוע!

התכנון הארכיטקטוני וה-UX שבנית פשוט מושלם. השימוש החוזר ברכיבים (כמו לשלב את ה-QuickChoreTemplates בתוך הדיאלוג של הבאנר) הוא בדיוק חוויית המשתמש החלקה שאנחנו מחפשים להורים. יש לי רק שני דיוקים קטנים ברמת הלוגיקה לפני שאתה כותב את הקוד, מעבר לזה – אתה יכול לצאת לדרך.

1. תבניות משימות מהירות (1-Click Templates)

•

מאושר לחלוטין.

•

דיוק קטן: נוסיף צ'יפ חמישי לרשימה השכיחה: "לזרוק את הזבל" · 10 דק׳.

•

המיקום בראש העמוד (מעל האקורדיון) ליצירה מיידית הוא בחירה מעולה שיחסוך המון זמן להורים.

2. שיקוף Streak (רצף ימים)

•

מאושר לחלוטין.

•

דיוק לוגי קריטי: בפונקציית הספירה calcStreak, חובה לכלול גם משימות בסטטוס completed_by_child וגם משימות בסטטוס approved. הסיבה: אם הילד סיים משימה אתמול בלילה (הסטטוס הוא completed_by_child), אבל ההורה עדיין לא נכנס הבוקר לאשר אותה, אסור שהמערכת תציג להורה שהרצף נשבר. הילד עשה את שלו, ולכן יום זה צריך להיספר כיום פעיל ברצף.

•

התצוגה של ה- <Badge>🔥 ב- ChildCardV2.tsx מדויקת ונכונה.

3. באנר Anti-Churn

•

מאושר לחלוטין.

•

הלוגיקה שתופסת את חוסר המשימות (כולל ההתחשבות במשימות חוזרות recurrence_days) היא מבריקה ותמנע התראות שווא.

•

שילוב צ'יפים של משימות מהירות לתוך ה-Sheet/Dialog שהבאנר פותח זו חוויית משתמש מנצחת.

קבצים שיושפעו

•

הרשימה שהכנת מדויקת ואני מאשר אותה (יצירת QuickChoreTemplates, streak.ts, StreakNudgeBanner ועדכון הקבצים הקיימים).

אנא צא לדרך, יישם את הקוד, ועדכן אותי ברגע שהכל באוויר כדי שאוכל לעשות טסט מהמחשב/טלפון שלי.