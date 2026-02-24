

# תיקון לוגיקת Chat Grouping — ריסק עולה = התראה חדשה

## הבעיה הנוכחית
שורות 856-884 ב-`analyze-alert/index.ts`: הבדיקה מחפשת **כל** התראה מאותו צ'אט ב-10 דקות אחרונות עם `should_alert = true`, בלי קשר לציון שלה. אם נמצאת — ההתראה החדשה נחסמת כ-`grouped`.

התוצאה: התראה #906 (ציון 70) נחסמה כי התראה #900 (ציון 35) מאותו צ'אט עובדה 10 דקות קודם, למרות שהיא הייתה `should_alert: true` עם verdict `monitor`.

## הפתרון
שינוי הלוגיקה כך שה-grouping חוסם **רק אם** ההתראה הקודמת מאותו צ'אט הייתה עם `ai_risk_score` **גבוה או שווה** לציון ההתראה הנוכחית.

אם הציון של ההתראה החדשה **גבוה יותר** מהקודמת — היא עוברת, נשלחת להורה, וה-timer של 10 דקות מתאפס (כי עכשיו **היא** תהיה ה-anchor לבדיקה הבאה).

## שינוי טכני

### קובץ: `supabase/functions/analyze-alert/index.ts`
**שורות 857-884** — עדכון הלוגיקת Chat Grouping:

**לפני:**
```typescript
const { data: recentSameChat } = await supabase
  .from('alerts')
  .select('id')
  .eq('child_id', alertData.child_id)
  .eq('chat_name', alertData.chat_name || '')
  .eq('should_alert', true)
  .gte('analyzed_at', tenMinAgo)
  .neq('id', alertId)
  .limit(1);

if (recentSameChat && recentSameChat.length > 0) {
  // → חסום כ-grouped
}
```

**אחרי:**
```typescript
const currentRiskScore = aiResult.risk_score ?? 0;

const { data: recentSameChat } = await supabase
  .from('alerts')
  .select('id, ai_risk_score')
  .eq('child_id', alertData.child_id)
  .eq('chat_name', alertData.chat_name || '')
  .eq('should_alert', true)
  .gte('analyzed_at', tenMinAgo)
  .neq('id', alertId)
  .order('ai_risk_score', { ascending: false })
  .limit(1);

const maxRecentScore = recentSameChat?.[0]?.ai_risk_score ?? 0;

if (recentSameChat && recentSameChat.length > 0 && currentRiskScore <= maxRecentScore) {
  // → חסום כ-grouped (ריסק לא עלה)
}
// אם currentRiskScore > maxRecentScore → ממשיך לשליחה
```

**ההבדל:** שדה `ai_risk_score` נוסף ל-select, ותנאי `currentRiskScore <= maxRecentScore` נוסף לבדיקה.

## התנהגות חדשה
| תרחיש | התראה קודמת | התראה חדשה | תוצאה |
|--------|------------|------------|--------|
| ריסק ירד | 70 | 35 | grouped ✓ |
| ריסק זהה | 70 | 70 | grouped ✓ |
| ריסק עלה | 35 | 70 | **נשלחת** ← timer מתאפס |
| אין קודמת | — | 70 | **נשלחת** |

## סיכום
- קובץ אחד: `supabase/functions/analyze-alert/index.ts`
- שינוי מינימלי: הוספת `ai_risk_score` ל-select + תנאי השוואה
- לא משפיע על Daily Cap או לוגיקה אחרת

