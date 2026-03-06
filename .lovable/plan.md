

## הפיכת כרטיסי הסטטיסטיקה ללחיצים עם סינון הרשימה

### מה ישתנה
הכרטיסים בראש טאב המשתמשים יהפכו ללחיצים. לחיצה על כרטיס תסנן את רשימת המשתמשים למטה לפי הקטגוריה הרלוונטית.

### לוגיקה

נוסיף state חדש `activeCard` עם ערכים: `'all' | 'online' | 'today' | 'no_device' | 'not_upgraded'`.

לחיצה על כרטיס תעדכן את ה-state (לחיצה חוזרת תחזיר ל-`all`). הסינון ב-`filteredUsers` יתעדכן:
- **סה"כ הורים** → מציג הכל (מאפס פילטר)
- **אונליין עכשיו** → `device_status === 'online'`
- **פעילים היום** → `device_status === 'online' || 'today'`
- **ללא מכשיר** → `device_status === 'no_device'`
- **לא שדרגו (פרימיום)** → סינון מיוחד: משתמשי פרימיום שיש להם מכשיר שלא שדרג (נשמור את ה-`notUpgradedUserIds` מה-useEffect הקיים)

### עיצוב
- כרטיס פעיל יקבל `ring-2 ring-primary` + `cursor-pointer`
- כל הכרטיסים יקבלו `cursor-pointer` + `hover:bg-muted/30` + `transition`
- הכותרת "רשימת משתמשים" תציג את שם הפילטר הפעיל

### קובץ
`src/pages/admin/AdminUsers.tsx` בלבד.

