

## תוכנית: הוספת זיהוי פלטפורמה ופילטר לממשק Admin

### קובץ יחיד לעדכון: `src/pages/admin/AdminAlertQA.tsx`

זהו המסך שמציג את רשימת ההתראות (QA) ואת הפרטים בדיאלוג.

### משימה 1 — Badge פלטפורמה

**ברשימה (טבלה):**
- הוספת `platform` ל-interface `AlertQARow` ולשאילתת ה-select
- הוספת עמודת "פלטפורמה" לטבלה עם Badge צבעוני:
  - `WHATSAPP` → ירוק עם אייקון MessageCircle
  - `INSTAGRAM` → סגול/ורוד עם אייקון Camera (או Instagram-style icon)

**בדיאלוג פרטים:**
- הוספת שורה ל-grid הקיים: Platform + Chat Type מוצגים ביחד בצורה ברורה

### משימה 2 — פילטר Dropdown

- הוספת state `platformFilter` עם ערכים: `'all' | 'WHATSAPP' | 'INSTAGRAM'`
- הוספת `Select` dropdown מעל הטבלה
- עדכון `fetchAlerts` — כשהפילטר לא `'all'`, הוספת `.eq('platform', platformFilter)` לשאילתה
- הוספת `useEffect` שמאזין לשינויי פילטר וטוען מחדש

### סיכום שינויים

| קובץ | שינוי |
|---|---|
| `src/pages/admin/AdminAlertQA.tsx` | הוספת platform ל-interface, select, טבלה, דיאלוג, ו-dropdown filter |

