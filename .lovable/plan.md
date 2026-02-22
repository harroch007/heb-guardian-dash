

# תיקון: סינון התראות בטוחות + הסרת תווית פרטי/קבוצה

## בעיה 1: התראות "safe" מוצגות להורה

הקוד ב-`Alerts.tsx` לא מסנן לפי `ai_verdict`, כך שהתראות עם verdict="safe" ו-risk_score=0 מוצגות להורה למרות שאין בהן תוכן בעייתי.

### תיקון:
- **`src/pages/Alerts.tsx`**: הוספת `.in('ai_verdict', ['notify', 'review'])` לשאילתות של חדשות ושמורות
- **`src/components/BottomNavigation.tsx`** (אם יש שם ספירה): אותו פילטר גם לספירת הבאדג'

---

## בעיה 2: הסרת תווית "שיחה פרטית" / "קבוצה"

במקום לנסות לזהות אם זו קבוצה או שיחה פרטית (מנגנון שנכשל שוב ושוב), פשוט נציג את **שם הצ'אט** בלבד.

### שינויים ב-Edge Function (`supabase/functions/analyze-alert/index.ts`):
- שורות 400-407: במקום "שיחה פרטית עם X" או "שיח Y בקבוצה X", הכותרת תהיה פשוט שם הצ'אט + prefix מתאר
- הכותרת החדשה: `"{title_prefix} — {chatName}"` (למשל: "שיחה רגילה — מרעיון לכפכפים")
- הסרת ההפרדה בין isGroupChat ל-private בבניית הכותרת
- עדכון ה-SYSTEM_PROMPT: במקום הפרדה בין PRIVATE ל-GROUP ב-title_prefix, AI יתאר את אופי השיחה בלי קשר לסוג

### שינויים ב-UI:
- **`src/components/alerts/AlertCardStack.tsx`** (שורות 238-248): הסרת אייקון User/Users ותווית "פרטי"/"קבוצה" מה-metadata row. במקום זה, הצגת שם הצ'אט בלבד
- **`src/components/alerts/AlertCardStack.tsx`** (שורה 155-159): עדכון fallback title — במקום "שיחה פרטית עם X", פשוט שם הצ'אט
- **`src/components/alerts/AlertDetailView.tsx`** (שורות 200-211): הסרת תווית "שיחה פרטית"/"שיחה קבוצתית"
- **`src/components/alerts/PositiveAlertCard.tsx`**: אותו שינוי

---

## סיכום קבצים

| קובץ | שינוי |
|---|---|
| `src/pages/Alerts.tsx` | הוספת פילטר `ai_verdict` בשאילתות |
| `src/components/BottomNavigation.tsx` | הוספת פילטר `ai_verdict` בספירת באדג' |
| `supabase/functions/analyze-alert/index.ts` | עדכון בניית כותרת + עדכון prompt |
| `src/components/alerts/AlertCardStack.tsx` | הסרת תווית פרטי/קבוצה, עדכון fallback title |
| `src/components/alerts/AlertDetailView.tsx` | הסרת תווית chat_type |
| `src/components/alerts/PositiveAlertCard.tsx` | הסרת תווית chat_type |

