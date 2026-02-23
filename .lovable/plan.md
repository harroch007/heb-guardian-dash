

# תוכנית בדיקות + תיקונים לאחר פריסת SYSTEM_PROMPT 2.0

## מצב נוכחי

### מה עובד
- SYSTEM_PROMPT 2.0 פרוס ורץ בפרודקשן
- שאילתת alert history (7 ימים) + child age/gender מוזרקים ל-userMessage
- social_context מנוקה בצד השרת (מוחק participants, null בפרטי)
- max_tokens מוגדל ל-2000

### מה עדיין דורש תיקון

**1. התראה 892 (Yariv Harroch) עובדה עם הפרומפט הישן**
- child_role עדיין "bystander" כי נותחה לפני הפריסה
- צריך לרוץ מחדש כדי לראות את ההבדל

**2. שרידי `participants` בפרונטנד (3 קבצים)**
- `src/pages/Alerts.tsx` שורה 11: interface עדיין מגדיר `participants: string[]`
- `src/components/alerts/AlertCardStack.tsx` שורות 12-14 + 298-303: מציג "משתתפים מרכזיים"
- `src/components/alerts/AlertDetailView.tsx` שורות 15, 128-132: עדיין מציג participants (אם קיימים)
- התראות ישנות ב-DB (למשל 885) עדיין מכילות participants ב-ai_social_context

**3. אין verdict guard בצד השרת**
- המנכ"ל ביקש פונקציית `deriveVerdictFromScore` שתאכוף את המיפוי risk_score -> verdict
- כרגע אם המודל יחליט verdict לא תואם ל-risk_score, אין הגנה

## שינויים לביצוע

### קובץ 1: `supabase/functions/analyze-alert/index.ts`
**הוספת verdict guard** — אחרי שורה 700 (`const aiResult = JSON.parse(aiContent)`)

הוספת פונקציה:
```
function deriveVerdictFromScore(score: number | null): string | null {
  if (typeof score !== 'number') return null;
  if (score <= 24) return 'safe';
  if (score <= 59) return 'monitor';
  if (score <= 79) return 'review';
  return 'notify';
}
```

ולוגיקת override:
```
const mappedVerdict = deriveVerdictFromScore(aiResult.risk_score ?? null);
if (mappedVerdict && aiResult.verdict !== mappedVerdict) {
  console.log(`Verdict mismatch: model=${aiResult.verdict}, mapped=${mappedVerdict} - overriding`);
  aiResult.verdict = mappedVerdict;
}
```

### קובץ 2: `src/pages/Alerts.tsx`
- הסרת `participants: string[]` מ-interface SocialContext (שורה 11)
- יישאר רק `label: string; description: string;`

### קובץ 3: `src/components/alerts/AlertCardStack.tsx`
- הסרת `participants: string[]` מ-interface SocialContext (שורה 13)
- הסרת בלוק "משתתפים מרכזיים" (שורות 298-303) שמציג participants.join
- השארת description בלבד

### קובץ 4: `src/components/alerts/AlertDetailView.tsx`
- הסרת `participants?: string[]` מ-interface (שורה 15) — כבר מוגדר optional, אבל נסיר לגמרי
- הסרת הבלוק שמציג "משתתפים מרכזיים" (שורות 128-132)

## בדיקות לאחר הפריסה

### בדיקה 1: הפעלה ידנית על alert קיים
- קריאה ל-edge function עם alert_id של התראה לא מעובדת (או יצירת חדשה)
- בדיקת logs: שורות Child age, Alert history, Relationship context מופיעות
- בדיקת DB: verdict תואם ל-risk_score ranges

### בדיקה 2: בדיקת UI
- רענון דף ההתראות
- וידוא שהתראות קבוצתיות ישנות (עם participants) לא שוברות את הדף
- וידוא שהתראות חדשות מציגות label + description בלבד

### בדיקה 3: private chat iron rule
- בדיקה שהתראות פרטיות חדשות מקבלות child_role = target/sender (לא bystander)
- בדיקה שהתראות פרטיות מקבלות social_context = null

## קבצים שישתנו

| קובץ | שינוי |
|-------|-------|
| `supabase/functions/analyze-alert/index.ts` | הוספת verdict guard |
| `src/pages/Alerts.tsx` | הסרת participants מ-interface |
| `src/components/alerts/AlertCardStack.tsx` | הסרת participants מ-interface + מתצוגה |
| `src/components/alerts/AlertDetailView.tsx` | הסרת participants מ-interface + מתצוגה |

