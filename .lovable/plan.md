## הקשר
ב-`ChildCardV2.tsx` יש שני סוגי דקות בונוס:
- `todayBonusMinutes` — בונוס שההורה כבר הוסיף היום, מתווסף ל-`effectiveLimit`.
- `rewardBankBalance` ("בנק בונוס") — דקות שהילד צבר ממשימות, **לא** מתווסף ללימיט עד שהילד פודה אותן.

לכן כשהילד חרג מהמכסה אבל יש לו יתרה בבנק (145 דק׳ בצילום), הבאנר נשאר אדום "המכשיר נעול" — ויוצר רושם שגוי שההורה צריך להתערב, בעוד שהילד פשוט יכול לפדות מהבנק.

## המטרה
שינוי **ויזואלי בלבד** בכרטיס הילד ב-Home V2 — בלי לגעת בלוגיקת אכיפה, RPC, או תנאי החסימה.

## שינויים (קובץ יחיד: `src/components/home-v2/ChildCardV2.tsx`)

### 1. משתנה חדש למצב "חרג אך יש בבנק"
```
const hasBankReserve = (child.rewardBankBalance ?? 0) > 0;
const exceededWithReserve = screenTimeExceeded && hasBankReserve;
const exceededHardLock   = screenTimeExceeded && !hasBankReserve;
```

### 2. באנר במקום האדום הקיים (שורות 142–150)
- אם `exceededHardLock` → להשאיר את הבאנר האדום הקיים ("המכשיר נעול — חרג ממגבלה").
- אם `exceededWithReserve` → להחליף לבאנר **ענבר** עם אייקון 🎁 (Gift):
  > "חרג מהמכסה היומית — יש {N} דק׳ בבנק זמינות לפדיון"
- צבעים: `bg-amber-500/10 border-b border-amber-300 text-amber-700` (תואם לבאנר ההגבלה הקיים).

### 3. עדכון `borderClass` (שורות 120–126)
- `exceededHardLock` → אדום (כמו היום).
- `exceededWithReserve` → ענבר (`border-amber-300`) במקום אדום.

### 4. תא "נותר" (שורות 223–231)
- אם `exceededWithReserve` → להציג במקום `0 דק׳`:
  - value: `"מהבנק"` או `formatMinutes(child.rewardBankBalance)`
  - icon: `Gift` ענבר
  - label: "זמין מהבנק"
  - `danger=false`, `warn=false`
  - helpText: "הילד חרג מהמכסה הבסיסית אך יכול לפדות דקות מהבנק כדי להמשיך."
- אחרת — ללא שינוי.

### 5. הדגשה קלה בתא "בנק בונוס" כשהוא בשימוש
כש-`exceededWithReserve` להוסיף `ring-1 ring-amber-300` לתא בנק בונוס (שורות 240–245) כדי לקשר ויזואלית בין הבאנר לתא.

## מה לא משתנה
- שום שינוי ב-`isConnected`, ב-`screenTimeExceeded`, או בחישוב `effectiveLimit`.
- שום שינוי בלוגיקת אכיפה / Edge Functions / DB.
- אם אין יתרה בבנק — חוויית "נעול אדום" נשמרת כפי שהיא.

## QA
1. ילד עם `usedMinutes ≥ effectiveLimit` ו-`rewardBankBalance = 0` → באנר אדום (כמו היום).
2. ילד עם `usedMinutes ≥ effectiveLimit` ו-`rewardBankBalance > 0` → באנר ענבר 🎁 + תא "נותר" מציג את יתרת הבנק.
3. ילד עם הגבלה פעילה (`activeRestriction`) → באנר ענבר של ההגבלה גובר (כמו היום).
4. ילד מנותק → באנר ניתוק אדום גובר על הכל (כמו היום).
