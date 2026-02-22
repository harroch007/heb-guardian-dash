

# שינוי סף מינימום נתונים לסיכומים ✅

## סטטוס: הושלם

## מה השתנה

### 1. ✅ Edge Function — העלאת סף ל-"insufficient"

- שבועי: פחות מ-3 ימים = `insufficient` (לא ייווצר סיכום)
- חודשי: פחות מ-15 ימים = `insufficient` (לא ייווצר סיכום)
- `partial` הוסר לגמרי — או `good` או `insufficient`
- התשובה מחזירה `days_with_data` ו-`min_required`

### 2. ✅ UI — הודעת "אין מספיק נתונים"

בדף `PeriodicSummary.tsx`, במצב שאין סיכום, מוצגת הודעה:
- שבועי: "נדרשים לפחות 3 ימי נתונים בשבוע כדי לייצר סיכום"
- חודשי: "נדרשים לפחות 15 ימי נתונים בחודש כדי לייצר סיכום"

## קבצים ששונו

| קובץ | שינוי |
|-------|-------|
| `supabase/functions/generate-periodic-summary/index.ts` | שינוי סף insufficient ל-3/15, הסרת partial, החזרת days_with_data + min_required |
| `src/pages/PeriodicSummary.tsx` | הוספת הודעה על מינימום ימים נדרשים |
