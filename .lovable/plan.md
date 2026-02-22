
# שיפור הקשר חברתי באנליזה - "Context-Aware Analysis"

## הבעיות

### באג טכני: chat_type שגוי
Alert 884 שמור כ-PRIVATE אבל "קיפי שלנו" היא קבוצה (מופיעה כ-GROUP ב-daily_chat_stats עם 36 הודעות ב-6 ימים). המכשיר לפעמים שולח chat_type שגוי. הקוד בונה את הכותרת לפי ה-DB בלבד ומתעלם מזיהוי ה-AI.

### בעיה אסטרטגית: חוסר הקשר חברתי
כרגע ה-AI מקבל רק את ההודעות + chat_type + author_type. הוא לא יודע:
- האם זו קבוצה של חברים קרובים (36 הודעות ב-6 ימים) או קבוצה חדשה/זרה
- האם השולח הוא איש קשר מוכר או מספר לא ידוע
- האם הילד מתכתב עם אדם זה באופן קבוע

בלי המידע הזה, "אתה זבל מסריח" תמיד ייראה כמו בריונות -- גם כשזה סתם שטויות בין חברים.

## הפתרון: "Relationship Context Enrichment"

### שלב 1: תיקון chat_type (Fallback חכם)
**קובץ:** `supabase/functions/analyze-alert/index.ts`

כשבונים את הכותרת, אם ה-DB אומר PRIVATE אבל ה-AI זיהה `is_group_chat: true`, נעדיף את זיהוי ה-AI. בנוסף, נבדוק ב-`daily_chat_stats` אם הצ'אט הזה רשום כ-GROUP.

```text
Logic:
1. Start with DB chat_type
2. If DB says PRIVATE but AI says is_group_chat=true -> use GROUP
3. If still unsure, check daily_chat_stats for this chat_name
```

### שלב 2: אסוף "Relationship Signal" לפני הניתוח
**קובץ:** `supabase/functions/analyze-alert/index.ts`

לפני קריאת ה-AI, שאילתה ל-daily_chat_stats כדי לקבל:
- `total_messages`: כמה הודעות הוחלפו עם הצ'אט הזה מאז ומעולם
- `active_days`: כמה ימים שונים הייתה פעילות
- `familiarity_level`: "close_contact" (יותר מ-50 הודעות ו-5 ימים), "regular" (10+ הודעות), "new_or_rare" (פחות מ-10), "unknown" (לא נמצא בכלל)

### שלב 3: העשרת ה-AI Prompt עם הקשר חברתי
**קובץ:** `supabase/functions/analyze-alert/index.ts`

הוסף סקשן חדש ב-SYSTEM_PROMPT:

```text
RELATIONSHIP CONTEXT (CRITICAL FOR ACCURATE SCORING)
You will receive a "relationship_context" field with:
- familiarity_level: "close_contact" | "regular" | "new_or_rare" | "unknown"
- total_messages: historical message count with this chat/contact
- active_days: how many days this chat has been active

SCORING ADJUSTMENT RULES:
1. close_contact + group chat + playful/joking tone -> 
   REDUCE risk_score by 30-50 points. Friends joking around is NOT bullying.
2. new_or_rare or unknown + aggressive content -> 
   KEEP or INCREASE risk_score. Unknown contacts with aggression = real concern.
3. close_contact + private + aggressive -> 
   Moderate reduction (10-20). Even friends can cross lines in private.
4. Regular family group (chat name contains "משפחה") + banter -> 
   Significant reduction (40-60). Family dynamics are usually safe.

The relationship between participants is THE MOST IMPORTANT factor.
"אתה זבל" from a best friend in a group = banter (risk ~15)
"אתה זבל" from an unknown number in private = potential bullying (risk ~65)
```

### שלב 4: שינוי ה-User Message ל-AI
**קובץ:** `supabase/functions/analyze-alert/index.ts`

הוסף את ה-relationship context ל-prompt שנשלח ל-AI:

```text
Before (current):
"Analyze this message content:
Chat type: GROUP
Author type: UNKNOWN
[messages]"

After (enriched):
"Analyze this message content:
Chat type: GROUP
Author type: UNKNOWN
Relationship context: familiarity_level=close_contact, total_messages=36, active_days=6
Chat name hint: 'קיפי שלנו' (family/friend group pattern)
[messages]"
```

### שלב 5: עדכון הכותרת וה-Verdict בהתאם
**קובץ:** `supabase/functions/analyze-alert/index.ts`

- כשה-AI מחזיר risk_score נמוך (בזכות ההקשר), הכותרת תהיה מתונה
- כשהילד הוא bystander בקבוצה של חברים קרובים, הסיכום יבהיר: "נצפה תוכן גס בקבוצת חברים -- ככל הנראה צחוק בין חברים"

---

## סיכום השינויים

| קובץ | שינוי |
|-------|-------|
| `analyze-alert/index.ts` | תיקון chat_type fallback (AI > DB) |
| `analyze-alert/index.ts` | שאילתת daily_chat_stats לפני ניתוח |
| `analyze-alert/index.ts` | העשרת SYSTEM_PROMPT עם כללי relationship |
| `analyze-alert/index.ts` | הוספת relationship_context ל-user message |

כל השינויים בקובץ אחד. לא נדרשים שינויי DB או שינויים בצד הלקוח.

## התוצאה הצפויה

**לפני:**
- "אתה זבל מסריח" בקבוצת חברים -> risk 75, verdict "review", הורה מודאג
- "אתה זבל מסריח" מזר בפרטי -> risk 75, verdict "review", הורה מודאג
- אותה תגובה לשני המקרים = "זאב זאב"

**אחרי:**
- "אתה זבל מסריח" בקבוצת חברים (36 הודעות, 6 ימים) -> risk ~20, verdict "safe", לא מגיע להורה
- "אתה זבל מסריח" מזר בפרטי (0 הודעות, לא מוכר) -> risk ~70, verdict "review", הורה מקבל התראה מדויקת

זה ההבדל בין חברה של מליון דולר לבין רעיון נחמד.
