

# שיפור תובנות AI -- ביסוס על נתונים אמיתיים

## הבעיה

ה-AI מקבל payload דל מאוד:
- מספרים יבשים: messages_scanned, ai_sent, alerts_sent
- שמות צ'אטים ואפליקציות
- סטטוס מכשיר

**חסר לו לחלוטין**: מה באמת קרה בהתראות? על מה הן? מי מעורב? קבוצתי או פרטי?

בלי המידע הזה, ה-AI ממציא נרטיבים כמו "אירועים חברתיים מרגשים" -- אין שום דבר שמגבה את זה.

## הפתרון

להעשיר את ה-payload שנשלח ל-AI עם נתוני התראות אמיתיים מהיום, ולחדד את הפרומפט.

### שלב 1: העשרת ה-payload (Edge Function)

**קובץ**: `supabase/functions/generate-daily-insights/index.ts`

אחרי שליפת metrics, top_chats, top_apps -- נוסיף שליפה של סיכומי התראות מהיום:

```sql
SELECT 
  ai_title,
  category,
  child_role,
  chat_type,
  ai_risk_score,
  expert_type
FROM alerts
WHERE child_id = p_child_id
  AND created_at::date = p_date
  AND analyzed_at IS NOT NULL  -- רק התראות שעברו ניתוח AI
  AND processing_status = 'notified'  -- רק כאלה שנשלחו להורה
```

ה-payload החדש יכלול שדה `alerts_context`:

```json
{
  "alerts_context": [
    {
      "title": "שיחה קבוצתית עם חברים מהכיתה",
      "category": "bullying_humiliation", 
      "child_role": "bystander",
      "chat_type": "GROUP",
      "risk_score": 72,
      "expert_type": "child_psychologist"
    }
  ]
}
```

גם נוסיף `chat_type_breakdown` -- כמה מההודעות בקבוצות לעומת פרטי:

```json
{
  "chat_type_breakdown": {
    "GROUP": 85,
    "PRIVATE": 22
  }
}
```

### שלב 2: חידוד הפרומפט

עדכון ה-SYSTEM_PROMPT כך שידע להשתמש בנתונים החדשים:

- להסתמך על `alerts_context` כדי לתאר את אופי היום
- להשתמש ב-`child_role` כדי להבדיל בין "הילד היה מעורב ישירות" לעומת "הילד היה צופה מהצד"
- להשתמש ב-`chat_type_breakdown` כדי לומר "רוב התקשורת התנהלה בקבוצות" רק כשזה באמת כך
- כלל חדש: "אם אין alerts_context, אל תמציא אירועים -- תגיד שהיום היה שקט"
- כלל חדש: "כל תובנה חייבת להיות ניתנת למעקב חזרה לשדה בנתונים"

### שלב 3: הוספת כלל "אם אין נתונים -- אל תמציא"

הפרומפט יכלול הוראה מפורשת:

```
ANTI-HALLUCINATION RULES:
1. If alerts_context is empty, do NOT mention events, incidents, or social dynamics.
2. Every insight MUST be traceable to a specific field in the data.
3. If you cannot point to the data that supports a claim, do NOT make that claim.
4. Prefer "יום שגרתי ללא אירועים חריגים" over invented narratives.
```

## פירוט טכני

| קובץ | שינוי |
|------|-------|
| `supabase/functions/generate-daily-insights/index.ts` | שליפת alerts + chat_type_breakdown, הוספה ל-payload, עדכון prompt |

### שליפת הנתונים (באמצעות serviceClient כדי לעקוף RLS):

```typescript
// Alert summaries for today
const { data: alertsSummary } = await serviceClient
  .from('alerts')
  .select('ai_title, category, child_role, chat_type, ai_risk_score, expert_type')
  .eq('child_id', child_id)
  .gte('created_at', date + 'T00:00:00+03:00')
  .lt('created_at', date + 'T23:59:59+03:00')
  .not('analyzed_at', 'is', null)
  .eq('processing_status', 'notified')
  .limit(10);

// Chat type breakdown from daily_chat_stats
const { data: chatBreakdown } = await serviceClient
  .from('daily_chat_stats')
  .select('chat_type, message_count')
  .eq('child_id', child_id)
  .eq('stat_date', date);
```

### Payload החדש:

```typescript
const payload = {
  window: { date, timezone: 'Asia/Jerusalem' },
  metrics: { ... },
  top_chats: ...,
  top_apps: ...,
  device_status: { ... },
  severity_band,
  data_quality,
  // NEW:
  alerts_context: alertsSummary?.map(a => ({
    title: a.ai_title,
    category: a.category,
    child_role: a.child_role,
    chat_type: a.chat_type,
    risk_score: a.ai_risk_score,
    expert_type: a.expert_type
  })) ?? [],
  chat_type_breakdown: chatBreakdownMap  // { GROUP: 85, PRIVATE: 22 }
};
```

אין שינויי DB -- הכל קריאה ממידע קיים.
