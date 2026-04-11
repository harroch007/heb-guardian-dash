

# התאמת UI למשתמש חינמי

## שינויים

### 1. FamilyStatusHero — הסתרת "הכול תקין" למשתמש חינמי
**קובץ:** `src/components/home-v2/FamilyStatusHero.tsx`
- הוספת prop `hasPremium: boolean`
- כשאין פרימיום: במקום "הכול תקין כרגע" להציג טקסט ניטרלי כמו "שדרגו לפרימיום כדי להפעיל ניטור חכם"
- הסתרת pill של "פתוחים" (התראות) כי אין ניטור פעיל

**קובץ:** `src/pages/HomeV2.tsx`
- העברת `hasPremium` ל-FamilyStatusHero

### 2. FamilyV2 — הסתרת כרטיס "פרימיום" כשהערך 0
**קובץ:** `src/pages/FamilyV2.tsx`
- הסתרת הכרטיס עם `Crown` + "פרימיום" כש-`premiumCount === 0`
- הכרטיס יופיע רק כשיש לפחות ילד אחד עם מנוי פרימיום

### 3. EmptyAlertsState — טקסט מותאם למשתמש חינמי
**קובץ:** `src/components/alerts/EmptyAlertsState.tsx`
- הוספת prop `hasPremium: boolean`
- כשחינמי: הצגת טקסט מזמין כמו "קיפי עדיין לא מנטרת את ההודעות של ילדכם. שדרגו לפרימיום כדי לקבל התראות חכמות על תכנים מסוכנים" עם כפתור שדרוג
- כשפרימיום: השארת הטקסט הנוכחי "הכל רגוע"

**קובץ:** `src/pages/AlertsV2.tsx`
- העברת `hasPremium` ל-EmptyAlertsState

