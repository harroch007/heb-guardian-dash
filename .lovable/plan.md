

## תיקון באג קריטי + שיפור Prompt ניתוח התראות

### בעיה 1: Check Constraint שובר את כל ההתראות
ה-constraint הנוכחי על `processing_status` מאפשר רק: `pending`, `analyzing`, `notifying`, `succeeded`, `failed`.
אבל ה-Edge Function כותב: `analyzed`, `notified`, `grouped`, `daily_cap`.
התוצאה: **כל התראה שמנותחת נכשלת** כי ה-UPDATE נדחה.

### בעיה 2: Prompt לא מבחין מי אמר למי
ה-AI לא מקבל הנחיה ברורה להבדיל בין:
- הודעה מהילד vs ממישהו אחר בקבוצה
- הודעה **על** הילד vs על צד שלישי
- הקשר משפחתי רגיל vs מאיים

### תיקונים

**1. מיגרציה - עדכון Check Constraint**
```sql
ALTER TABLE public.alerts DROP CONSTRAINT alerts_processing_status_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_processing_status_check
  CHECK (processing_status IN (
    'pending', 'analyzing', 'analyzed', 
    'notifying', 'notified', 
    'grouped', 'daily_cap',
    'succeeded', 'failed'
  ));
```

**2. שיפור System Prompt ב-`supabase/functions/analyze-alert/index.ts`**

הוספת סעיף חדש ל-SYSTEM_PROMPT שמנחה את ה-AI לשקלל author_type ונמען:

```text
AUTHOR & TARGET ANALYSIS (CRITICAL FOR SCORING)
- Each message has an "origin" or "from" field indicating who sent it.
- The CHILD is the person being monitored. Messages have author_type: CHILD, OTHER, or UNKNOWN.
- When scoring risk, consider WHO said the message and WHO it targets:
  1. Message BY the child containing dangerous content -> HIGH risk (direct involvement)
  2. Message TO the child that is threatening/exploitative -> HIGH risk (child is target)
  3. Message BY another person ABOUT a third party (not the child) -> LOW risk
  4. General group banter, family chat, jokes about unrelated people -> LOW risk
- A message like "I hope X punches Y" said by someone else about a third party
  in a family group is NOT a reason to alert the parent about their child.
- Only escalate when the CHILD is directly involved as sender, recipient, or target.
- Reduce risk_score by 30-50 points when the child is neither the author nor the target.
```

**3. שיפור ה-user message שנשלח ל-OpenAI**

הוספת `author_type` ו-`chat_type` מה-alert record לפרומפט, כדי ש-AI יקבל את ההקשר:

```text
Analyze this message content:
Chat type: {chat_type}
Author type of flagged message: {author_type}

{redacted content}
```

### סיכום השינויים

| קובץ | שינוי |
|-------|-------|
| מיגרציה SQL | עדכון check constraint - הוספת analyzed, notified, grouped, daily_cap |
| `supabase/functions/analyze-alert/index.ts` | הוספת סעיף AUTHOR & TARGET ANALYSIS ל-prompt + העברת author_type ל-AI |

