

## בעיה

בדיאלוג הפרטים של AdminTraining (שורה 209), ה-`DialogContent` מוגדר עם `overflow-hidden` — מה שחוסם גלילה ברמת הדיאלוג. התוכן הפנימי (metadata badges, raw text, AI verdict JSON) עלול לחרוג מגובה 80vh בלי אפשרות לגלול.

## פתרון

1. **שינוי ב-`DialogContent`** (שורה 209 ב-`AdminTraining.tsx`):
   - להחליף `overflow-hidden` ב-`overflow-y-auto` כדי לאפשר גלילה כשהתוכן חורג

2. **התאמת גבהים פנימיים**:
   - להקטין את ה-`max-h-[40vh]` של ה-ScrollArea של raw_text ל-`max-h-[30vh]` כדי להשאיר מקום ל-JSON
   - להגדיל את ה-`max-h-[150px]` של AI Verdict JSON ל-`max-h-[200px]`

### שינוי יחיד בקובץ אחד
**`src/pages/admin/AdminTraining.tsx`** — שורה 209:
```
// לפני:
max-w-2xl max-h-[80vh] overflow-hidden flex flex-col

// אחרי:
max-w-2xl max-h-[85vh] overflow-y-auto flex flex-col
```

זה יאפשר גלילה מלאה בדיאלוג כך שכל התוכן — כולל ה-JSON התחתון — יהיה נגיש.

