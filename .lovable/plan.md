

# Guards + כלי QA + Re-analyze לאדמין

## סקירה

4 שינויים מרכזיים:
1. **Guards בצד השרת** — תיקון child_role ו-social_context אוטומטי
2. **שמירת ai_analysis מלא** — לכל alert, שמירת ה-JSON המלא מהמודל בעמודת `ai_analysis` (כבר קיימת בטבלה)
3. **כלי QA באדמין** — טאב חדש "QA התראות" שמציג את כל ה-ai_result המלא לכל alert
4. **Re-analyze** — כפתור בממשק QA + תמיכה בטווח IDs להרצה מחדש של ניתוח

## שינויים טכניים

### קובץ 1: `supabase/functions/analyze-alert/index.ts`

**Guard 1 — child_role בפרטי:**
אחרי ה-verdict guard (שורה ~716), הוספת:
```
// Iron rule: private chats cannot have bystander
if (!isGroupChat && aiResult.child_role === 'bystander') {
  console.log(`CHILD_ROLE_GUARD: Overriding bystander -> unknown for PRIVATE chat, alert_id=${alertId}`);
  aiResult.child_role = 'unknown';
}
```

בעיה: `isGroupChat` מחושב רק בשורה 770 (אחרי ה-guard). צריך להזיז את ה-guard לאחרי חישוב `isGroupChat` (שורה ~770), או לחשב את `isGroupChat` מוקדם יותר. הפתרון: להזיז את ה-guard לאחרי שורה 770.

**Guard 2 — social_context בקבוצות:**
בבלוק social_context (שורה 777-785), להרחיב:
```
if (!isGroupChat) {
  cleanedSocialContext = null;
} else {
  // Group chat: ensure valid social_context
  if (!cleanedSocialContext || typeof cleanedSocialContext !== 'object') {
    console.log(`SOCIAL_CONTEXT_GUARD: Building default for GROUP chat, alert_id=${alertId}`);
    cleanedSocialContext = {
      label: "הקשר חברתי",
      description: "שיחה קבוצתית"
    };
  }
  // Remove any participants array
  delete cleanedSocialContext.participants;
  // Ensure required fields
  if (!cleanedSocialContext.label) cleanedSocialContext.label = "הקשר חברתי";
  if (!cleanedSocialContext.description) cleanedSocialContext.description = "שיחה קבוצתית";
}
```

**שמירת ai_analysis מלא:**
ב-updateData (שורה ~793), הוספת:
```
ai_analysis: aiResult,  // Store full AI response for QA
```
ובנוסף שמירת `ai_patterns` ו-`ai_classification` ו-`ai_confidence`:
```
ai_patterns: aiResult.patterns || null,
ai_classification: aiResult.classification || null,
ai_confidence: typeof aiResult.confidence === 'number' ? aiResult.confidence : null,
```

### קובץ 2: `src/pages/admin/AdminAlertQA.tsx` (חדש)

מסך QA שמציג טבלת התראות אחרונות עם:
- ID, תאריך, chat_name, verdict, risk_score, child_role, chat_type
- כפתור "פרטים" שפותח modal עם ה-JSON המלא של ai_analysis
- כפתור "הרץ מחדש" לכל alert בודד
- כפתור "Re-analyze range" בראש העמוד — מאפשר לבחור טווח IDs (מ-ID עד ID) ולהריץ מחדש

הנתונים נשלפים מ-alerts עם שדות:
`id, created_at, chat_name, chat_type, ai_verdict, ai_risk_score, child_role, ai_analysis, ai_social_context, ai_title, ai_summary, ai_recommendation, ai_patterns, ai_classification, ai_confidence, ai_meaning, ai_context`

### קובץ 3: `src/pages/Admin.tsx`

הוספת טאב 6 — "QA" עם אייקון Search/Microscope:
- ייבוא AdminAlertQA
- הוספת TabsTrigger ו-TabsContent
- שינוי grid-cols-5 ל-grid-cols-6

### קובץ 4: `supabase/functions/analyze-alert/index.ts` — תמיכה ב-re-analyze

בהנדלר הראשי, הוספת מצב חדש:
```
// RE-ANALYZE MODE — { mode: 'reanalyze', from_id: 880, to_id: 900 }
if (body.mode === 'reanalyze' && body.from_id && body.to_id) {
  // Reset is_processed for range, then process each
}
```

בפועל, ה-re-analyze יעבוד כך:
- הפרונטנד שולח לכל alert בנפרד `{ alert_id: X }` (הנתיב הקיים כבר עובד)
- ה-function כבר תומכת בזה דרך הנתיב ה-legacy
- צריך רק לוודא שכשקוראים ל-processAlert על alert שכבר processed, הוא לא נחסם

בדיקה: בפונקציית processAlert, שורה ~490, יש בדיקה:
```
if (alert.is_processed) {
  console.log(`Alert ${alertId} already processed, skipping`);
  return { ... status: 'already_processed' };
}
```

צריך להוסיף פרמטר `force` שעוקף את הבדיקה הזו:
```
async function processAlert(supabase, alertId, openAIApiKey, supabaseUrl, supabaseServiceKey, force = false)
```

ובהנדלר הראשי, כשיש `body.force === true`, להעביר `force=true`.

## תהליך QA באדמין

המסך יאפשר:
1. **צפייה** — טבלת 50 התראות אחרונות עם כל השדות המרכזיים
2. **חקירה** — לחיצה על שורה פותחת את ה-JSON המלא של ai_analysis
3. **Re-analyze בודד** — כפתור לכל שורה
4. **Re-analyze טווח** — הזנת from_id ו-to_id, לולאה בפרונטנד ששולחת כל אחד בנפרד

## סיכום קבצים

| קובץ | שינוי |
|-------|-------|
| `supabase/functions/analyze-alert/index.ts` | Guards + ai_analysis save + force param |
| `src/pages/admin/AdminAlertQA.tsx` | מסך QA חדש |
| `src/pages/Admin.tsx` | טאב QA חדש |

## אין שינויי DB
עמודת `ai_analysis` (jsonb), `ai_patterns` (array), `ai_classification` (jsonb), `ai_confidence` (float) כבר קיימות בטבלת alerts.
