
# שיפור Relationship Context -- מנתונים גולמיים במקום labels

## הבעיה

הגישה הנוכחית מחשבת `familiarity_level` לפי ספים קשיחים (50 הודעות + 5 ימים = "close_contact"). זה לא אמין:
- "וועד הבניין" עם 50 הודעות ביומיים = לא חברים
- "קיפי שלנו" עם 20 הודעות ב-10 ימים = כנראה חברים קרובים
- קבוצת "כיתה ד2 הורים" עם 200 הודעות = קבוצת הורים, לא רלוונטי

שם הצ'אט מספר יותר מכמות ההודעות.

## הפתרון: תן ל-AI לפרש, לא לקוד

במקום לחשב label בקוד ולהגיד ל-AI "זה close_contact" -- נעביר את הנתונים הגולמיים ונתן ל-AI (שמבין עברית ושמות קבוצות) להחליט מה המשמעות.

### שינויים בקובץ `supabase/functions/analyze-alert/index.ts`

#### 1. הסרת חישוב familiarity_level מהקוד

הקוד הנוכחי (שורות 239-268) מחשב `familiarityLevel` לפי ספים. נחליף את זה בהעברת הנתונים הגולמיים בלבד:

```text
Before:
  if (totalMessages >= 50 && activeDays >= 5) {
    familiarityLevel = 'close_contact';
  } else if (totalMessages >= 10) { ... }

After:
  // Just pass raw data, let AI interpret
  // No familiarity_level computation
```

#### 2. עדכון ה-User Message

במקום שורת `familiarity_level=close_contact`, נעביר:

```text
Before:
  "Relationship context: familiarity_level=close_contact, total_messages=36, active_days=6"

After:
  "Relationship context: total_messages=36, active_days=6, chat_type_from_stats=GROUP"
  "Chat name: 'קיפי שלנו'"
```

שם הצ'אט כבר מועבר, אבל נוודא שהוא בולט כחלק מה-relationship context.

#### 3. עדכון ה-SYSTEM_PROMPT

החלפת הסקשן "SCORING ADJUSTMENT RULES" מכללים מבוססי label לכללים מבוססי הקשר:

```text
RELATIONSHIP CONTEXT (CRITICAL FOR ACCURATE SCORING)
You will receive raw relationship data:
- total_messages: historical message count with this chat
- active_days: how many different days this chat has been active
- chat_name: the actual name of the chat/group

IMPORTANT: Message count alone does NOT indicate friendship.
Use chat_name as the PRIMARY signal for relationship type:

CHAT NAME PATTERNS (Hebrew):
- Contains "משפחה"/"בית"/"אמא"/"אבא" -> Family group, very safe context
- Contains "וועד"/"בניין"/"שכנים" -> Neighbors/building committee, NOT friends
- Contains "כיתה"/"הורים"/"מורה" -> School/parents group, formal context
- Contains "עבודה"/"צוות"/"משרד" -> Work group, formal context
- Informal/playful names ("קיפי שלנו", "החבר'ה", nicknames) -> Likely friend group

SCORING RULES:
1. Friend group (informal name) + playful/joking tone -> 
   REDUCE risk by 30-50. Friends joking is NOT bullying.
2. Formal/institutional group + aggressive content ->
   Still concerning but context-dependent. Reduce by 10-20 max.
3. Unknown/new contact (total_messages < 5) + aggressive content ->
   KEEP or INCREASE risk. Unknown contacts = real concern.
4. Family group + banter -> Significant reduction (40-60).
5. Private chat + high message history (50+ messages, 5+ days) ->
   Likely established relationship. Moderate reduction (15-25).
6. Private chat + very low history (< 5 messages) ->
   New contact. Be more cautious.
```

## סיכום

| מה משתנה | לפני | אחרי |
|----------|------|-------|
| חישוב familiarity | קוד קשיח עם ספים | AI מפרש לבד |
| סיגנל מרכזי | כמות הודעות | שם הצ'אט + כמות הודעות |
| "וועד הבניין" 50 הודעות | close_contact (שגוי) | AI מזהה "וועד" = לא חברים |
| "קיפי שלנו" 20 הודעות | regular (שגוי) | AI מזהה שם לא-פורמלי = חברים |

הכל בקובץ אחד: `supabase/functions/analyze-alert/index.ts`. אין שינויי DB או צד לקוח.
