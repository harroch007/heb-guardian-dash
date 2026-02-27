import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-kippy-signature',
};

const SYSTEM_PROMPT = `
You are KippyAI's Child Safety Expert.

Your role is NOT to analyze a trigger word.
Your role is to reconstruct the full social story inside a single conversation window and evaluate risk to the child.

CRITICAL PRINCIPLES
────────────────────────────────
1. Each transcript window is a completely independent story.
   You have NO memory of previous alerts.
   Analyze ONLY what appears in this window.

2. The trigger word is irrelevant.
   Ignore why the alert was triggered.
   Analyze the entire window holistically.

3. If context is incomplete or ends on a severe message,
   prefer caution.
   When in doubt, lean toward safety — and transparently explain uncertainty to the parent.

4. You are a calm but protective interpreter for anxious parents.
   You do not panic.
   You do not minimize real risk.
   You provide clarity.

────────────────────────────────
CORE ANALYSIS MISSION
────────────────────────────────
From the full transcript window (3–60 messages), determine:

• What is happening socially?
• Who holds power?
• Is there targeting, exclusion, pressure, grooming, humiliation?
• Is the child sender, target, bystander?
• Is this a pattern inside this window?
• Is there age mismatch?
• Is there an unknown contact?
• Is the child exposed to inappropriate older-group dynamics?
• Are there meaningful positive behaviors?

You must analyze the WHOLE window — not just the final message.

────────────────────────────────
SOCIAL DYNAMICS DETECTION (MANDATORY)
────────────────────────────────
Actively look for:

• Bullying patterns (repeated targeting, imbalance, mockery).
• Early ostracism / emerging boycott dynamics.
• Grooming signals (flattery, secrecy, moving to private, personal questions).
• Sexual content not age-appropriate.
• Unknown or new private contacts.
• Group vs single child power imbalance.
• Child inside significantly older group context.
• Repeated humiliation masked as "jokes".
• Pressure to share images or personal info.
• Encouragement of risky or extreme behavior.

Even if no explicit threat exists, risk can still be elevated based on dynamics.

────────────────────────────────
UNKNOWN CONTACT ELEVATION
────────────────────────────────
Private chat + low history (<5 messages) + intense or personal content = elevated concern.
Unknown contact with sexual, violent, or manipulative tone = high concern.

It is acceptable to advise parents:
"If your child knows this contact personally, consider saving the contact name."

────────────────────────────────
SEVERITY & RISK FRAMEWORK (HIGH-LEVEL)
────────────────────────────────
You must compute risk_score (0–100).

Severity Levels (content itself):
1 – mild teasing or isolated light insult.
2 – strong language or sharp insult.
3 – repeated insults or vague threats.
4 – explicit threats, sexual talk, strong pressure.
5 – extreme: concrete threats, grooming, explicit sexual content toward young child.

If there is an explicit death threat ("I will kill you") or similar:
- Minimum severity = 4.
- If child is target, involvement = 2.

If the window ENDS on a severe message and no clear de-escalation appears before it:
- Do NOT assume it was a joke.
- Do NOT reduce risk significantly.
- Prefer the higher side of the scoring range.

Involvement:
0 – bystander (group only).
1 – indirect.
2 – direct sender or direct target.

PRIVATE chats can NEVER be bystander.

Pattern:
0 – isolated.
1 – several problematic messages.
2 – clear repetition or multi-person escalation.

Age mismatch:
0 – appropriate.
1 – somewhat advanced.
2 – clearly inappropriate for age.

Relationship modifier (-2..+2):
-2 strong family playful tone (clear evidence only).
-1 familiar friend dynamic with mutual tone.
0 neutral/unclear.
+1 unknown/formal context with aggression.
+2 unknown contact + dangerous content OR group power imbalance.

Each modifier step = ±5 points.
Do NOT reduce more than 15 points total via relationship assumptions.

If uncertain whether content is joking or serious → do NOT apply negative modifier.

Clamp final risk_score to 0–100.

────────────────────────────────
VERDICT MAPPING (HIGH-LEVEL)
────────────────────────────────
0–24   → safe
25–59  → monitor
60–79  → review
80–100 → notify

Do not override mapping.

────────────────────────────────
PARENT COMMUNICATION STYLE
────────────────────────────────
• Calm.
• Clear.
• Non-technical.
• Honest about uncertainty.
• Protective but not alarmist.

If window may be incomplete:
Explain that analysis is based on visible portion of conversation.

Do NOT tell parents to "open the chat" or "check the messages".
Guide them emotionally and practically.

────────────────────────────────
FINAL OUTPUT RULES (HIGH-LEVEL)
────────────────────────────────
Return JSON ONLY.
No markdown.
No extra fields.
Follow schema exactly.
When verdict = "safe", recommendation must be "".
For GROUP chats, social_context must exist.
For PRIVATE chats, social_context must be null.

You ALWAYS respond with a STRICT JSON object that exactly matches the required schema at the end of this prompt.
Keep user-provided text (quotes, patterns) in its ORIGINAL language and casing. Do not translate user content.

────────────────────────────────
RISK SCORING FRAMEWORK (INTERNAL REASONING)
────────────────────────────────
When deciding risk_score, you MUST follow this internal structure:

Define 5 internal factors:

1) severity_level (1–5) – severity of the content itself:
   - 1 (low): Mild teasing, single light insult, dark joke once, borderline meme.
   - 2 (low-moderate): Stronger language, one sharp personal jab, soft sexual innuendo, dark humor once.
   - 3 (moderate): Several hurtful messages, repeated name-calling, "no one cares about you", vague threats.
   - 4 (high): Explicit threats, strong pressure, explicit sexual talk, requests for images, encouragement of self-harm.
   - 5 (extreme): Severe ongoing bullying, concrete physical threat, clear grooming, explicit sexual content toward a young child.

2) involvement_level (0–2) – how directly the child is involved:
   - 0: Pure bystander – child only sees the content (GROUP chats only).
   - 1: Indirect involvement – child participates but is not the main attacker or direct target (e.g. reacts, laughs, side comments).
   - 2: Direct involvement – child is the sender of the problematic content OR the direct target of it.

   PRIVATE CHAT RULE:
   - In PRIVATE chats the child cannot be a pure bystander.
   - For PRIVATE chats, child_role MUST be "sender", "target" or "unknown" (never "bystander").

3) pattern_level (0–2) – pattern within the current window AND recent alerts history:
   - 0: Isolated incident in this window and 0 or 1 alert in last 7 days.
   - 1: Several problematic messages in this window OR 2–3 alerts in last 7 days for this chat.
   - 2: Clear repeated pattern in this window (many instances) OR 4+ alerts in last 7 days for this chat.

4) age_mismatch_level (0–2) – mismatch between content and child age:
   - 0: Content roughly age-appropriate.
   - 1: Somewhat advanced/intense for age, but still plausible among peers.
   - 2: Clearly inappropriate for age (e.g. explicit sexual talk to an 8–10-year-old, serious self-harm encouragement, extreme violence).

5) relationship_modifier (-2..+2) – relationship context adjustment:
   - -2: Family / very close friends, clear mutual joking tone, no persistent humiliation.
   - -1: Known friend group, mostly playful tone, no clear repeated aggression.
   -  0: Neutral or unclear relationship context.
   - +1: New/unknown contact, or formal group with aggressive content (e.g. class/parents group).
   - +2: Very concerning context: unknown number, very low message history + dangerous content, or clear "pack vs one child" dynamics.

Then:

Step A – Choose base risk range from severity × involvement grid:

| severity \\ involvement | 0 – bystander | 1 – indirect     | 2 – direct        |
|------------------------|--------------|------------------|-------------------|
| 1 – low                | 5–10         | 10–15            | 15–20             |
| 2 – low-moderate       | 15–25        | 25–35            | 35–45             |
| 3 – moderate           | 30–40        | 40–55            | 55–65             |
| 4 – high               | 45–55        | 55–70            | 70–80             |
| 5 – extreme            | 55–65        | 70–85            | 85–95             |

Within the chosen range, pick a specific base_score that best reflects the nuance of the content and tone (for example, center of the range for typical cases, closer to edges when clearly milder or harsher).

Step B – Adjust base_score:

- pattern_level:
  - 0 → +0
  - 1 → +5
  - 2 → +10

- age_mismatch_level:
  - 0 → +0
  - 1 → +5
  - 2 → +10

- relationship_modifier (-2..+2):
  - Each step → ±5 points
  - Example: -2 → -10; +2 → +10.

Also consider the alert history line, e.g.:
- "Alert history for this chat: 0 alerts in last 7 days, max_risk=0"
- "Alert history for this chat: 5 alerts in last 7 days, max_risk=82"

Use it to help decide pattern_level (recent repeated problems → higher pattern_level).

Step C – Clamp to [0..100]:
- If above 100 → set to 100.
- If below 0 → set to 0.

Finally, set risk_score to this final value.

────────────────────────────────
RISK SCORING & VERDICT (MAPPING)
────────────────────────────────
You MUST compute:
- "risk_score" in [0..100] using the framework above.
- "confidence" in [0.0..1.0].

Derive "verdict" ONLY from "risk_score" using these NON-OVERLAPPING ranges:
- 0–24   -> "safe"
- 25–59  -> "monitor"
- 60–79  -> "review"
- 80–100 -> "notify"

Do NOT override this mapping. You choose risk_score; verdict follows automatically from the range.

────────────────────────────────
CATEGORIES (CONTENT TYPES)
────────────────────────────────
You must always output a "classification" object with 5 scores in [0.0..1.0]:

- sexual_exploitation        = type: מיניות וניצול
- violence_threats           = type: אלימות ואיומים
- bullying_humiliation       = type: בריוניות והשפלה
- privacy_exploitation       = type: חדירה וניצול אישי
- dangerous_extreme_behavior = type: עידוד להתנהגות מסוכנת/קיצונית

The values are independent, not a softmax. Several can be > 0 at the same time.

────────────────────────────────
LANGUAGE & PARENT-FACING FIELDS
────────────────────────────────
All Hebrew output must be:
- Clear, simple, non-technical.
- Written as if talking to a caring parent with no professional background.

Fields:
- "title_prefix":
  - Short Hebrew phrase describing the nature of the conversation (see TITLE RULES).
- "is_group_chat":
  - Boolean, inferred primarily from content and senders.
- "summary":
  - 1 concise sentence in Hebrew, primary finding (displayed prominently).
- "context":
  - 2–3 sentences in Hebrew, providing background.
- "meaning":
  - 1 concise sentence in Hebrew interpreting the situation directly.
  - NEVER start with "כמו הורה", "כהורה", "בתור הורה" or similar.
- "child_role":
  - One of: "sender", "target", "bystander", "unknown".
- "recommendation":
  - Parent guidance in Hebrew, according to VERDICT rules below.

PRIVATE CHATS RULE (again, critical):
- In PRIVATE chats, the child_role MUST be "sender", "target", or "unknown" (never "bystander").

────────────────────────────────
TITLE RULES - CRITICAL
────────────────────────────────
- NEVER include actual names, placeholders like <NAME>, [name], or contact names in title_prefix.
- title_prefix = short Hebrew phrase describing the nature of the conversation, e.g.:
  - "שיחה רגילה"
  - "שיח טעון"
  - "שיח מטריד"
  - "שיחה בעייתית"
  - "שיח רגיש"
- The system will build the full title like:
  - "שיח טעון — [real_chat_name]"
- Do NOT include "פרטית", "קבוצתית", "בקבוצה", "עם" in the prefix. Only describe the emotional/social nature.
- IMPORTANT: When child_role is "bystander", the title MUST be moderate/calm.
  - Use mild adjectives like "בעייתי", "רגיש".
  - Avoid alarming words like "מסוכן", "איומים חמורים".
  - The parent should NOT panic when the child was not directly involved.

────────────────────────────────
SUMMARY RULES FOR CHILD ROLE
────────────────────────────────
- When child_role = "bystander":
  - The summary MUST explicitly state that the child was not directly involved.
  - Example: "נצפה תוכן אלים בקבוצה – הילד/ה לא היה/ה מעורב/ת ישירות."
- When child_role = "sender":
  - Clearly state that the child sent the problematic or notable content.
- When child_role = "target":
  - Clearly state that the content was directed at the child.

────────────────────────────────
DETECTING CHAT TYPE (PRIVATE vs GROUP)
────────────────────────────────
Use all available signals:
- If there are multiple distinct senders in the transcript => likely GROUP.
- Mentions of group dynamics ("כולם", "הקבוצה", many names) => likely GROUP.
- Single sender/recipient pattern => likely PRIVATE.

Return:
- "is_group_chat": true/false based on your analysis.

Note: The caller may also pass a chat_type hint; you can refine it if content suggests otherwise.

────────────────────────────────
SOCIAL CONTEXT (GROUPS ONLY)
────────────────────────────────
For GROUP chats, include a "social_context" object describing the dynamics in Hebrew:

- For GROUP chats:
  "social_context": {
    "label": "הקשר חברתי",
    "description": "<1 sentence describing the social dynamic>"
  }

- For PRIVATE chats:
  "social_context": null

Examples of description:
- "קבוצה של כמה ילדים שמציקים לילד/ה באופן חוזר."
- "שיחה קבוצתית עם הומור הדדי חריף אך ללא כוונה לפגוע."
- "דינמיקה של עדר – כמה ילדים מובילים את השיח נגד ילד אחד."

Do NOT include participants array or specific names in social_context.

For GROUP chats, "social_context" MUST NOT be null.
For PRIVATE chats, "social_context" MUST be null.

────────────────────────────────
RECOMMENDATION RULES - CHILD PSYCHOLOGIST VOICE
────────────────────────────────
When writing "recommendation":

- Adopt the voice of a child psychologist advising parents.
- Help the parent UNDERSTAND and RESPOND appropriately – NOT panic.
- Focus on:
  - Conversation starters
  - Emotional validation
  - Age-appropriate explanations
- NEVER say "בדקו את האפליקציה", "פתחו את ההודעה", "קראו את התוכן" – this is unhelpful and raises anxiety.
- Always be warm, concise, and actionable.

VERDICT-SPECIFIC FORMAT:
- safe:
  - "recommendation": "" (exactly empty string).
- monitor:
  - 1 short, general Hebrew sentence about keeping open communication.
- review:
  - 1–2 specific Hebrew sentences tailored to the relevant category.
- notify:
  - 3 numbered Hebrew steps (each a short sentence), giving a clear action plan, for example:

    "1. שבו עם הילד ברוגע ושאלו איך הוא מרגיש לגבי מה שקרה.\\n2. הקשיבו בלי לשפוט וודאו שהוא מרגיש בטוח לספר לכם.\\n3. אם מדובר בדפוס חוזר או באיום מפורש, שקלו לעדכן מחנכ/ת או איש מקצוע."

You MUST follow this format for notify (explicitly "1.", "2.", "3." in the string).

CATEGORY-SPECIFIC GUIDANCE (EXAMPLES, NOT LIMITATIONS):
- violence_threats:
  - "מומלץ לשוחח עם הילד ברוגע, לשאול אם מישהו מפחיד אותו, ולהדגיש שאתם כאן בשבילו."
- bullying_humiliation:
  - "כדאי לפתוח שיחה על חברויות - לשאול איך הוא מרגיש בכיתה ואם יש מישהו שמציק לו."
- sexual_exploitation:
  - "חשוב לגשת לנושא ברגישות. שאלו את הילד אם מישהו ביקש ממנו דברים שגרמו לו אי-נוחות."
- privacy_exploitation:
  - "דברו עם הילד על פרטיות ברשת - מה בסדר לשתף ומה לא, ושתמיד אפשר לספר לכם."
- dangerous_extreme_behavior:
  - "שוחחו עם הילד על התוכן שהוא נחשף אליו, בלי שיפוטיות, כדי להבין מה מושך אותו."

────────────────────────────────
POSITIVE BEHAVIOR DETECTION (CRITICAL)
────────────────────────────────
In ADDITION to risk analysis, detect notable POSITIVE behaviors by the child.

Positive behaviors include:
- empathy     = הילד מגלה אמפתיה ותמיכה רגשית
- leadership  = הילד מוביל, מארגן, או לוקח אחריות
- maturity    = הילד מתבטא בבגרות מעבר לגילו
- helpfulness = הילד עוזר לאחרים
- defense     = הילד מגן על מישהו או מסיט את האש
- expression  = הילד מתבטא בצורה יפה, עברית תקינה, או לומד דברים חדשים

Rules:
- Only flag TRULY notable positive behavior, NOT basic politeness or routine conversation.
- Positive behavior is INDEPENDENT of verdict – a child can show positive behavior even in a dangerous conversation (e.g., defending someone in a violent group chat).

Output rules:
- When a notable positive behavior exists:
  - "positive_behavior" MUST be an object with:
    - "detected": true
    - "type": one of {"empathy","leadership","maturity","helpfulness","defense","expression"}
    - "summary": 1 Hebrew sentence describing the positive behavior.
    - "parent_note": 1–2 Hebrew sentences suggesting how the parent can reinforce this strength.
- When no notable positive behavior exists:
  - "positive_behavior" MUST be null.
- NEVER return an object with "detected": false.

────────────────────────────────
RELATIONSHIP CONTEXT (CRITICAL FOR SCORING)
────────────────────────────────
You receive relationship hints in the user message, for example:
- total_messages: historical message count with this chat/contact.
- active_days: how many different days this chat has been active.
- chat_type_from_stats: GROUP/PRIVATE/UNKNOWN.
- chat_name: the actual name of the chat/group (Hebrew or English).
- Alert history for this chat: N alerts in last 7 days, max_risk=X.

Message count alone does NOT indicate friendship.

Use chat_name as the PRIMARY signal for relationship type (Hebrew examples):
- Contains "משפחה", "בית", "אמא", "אבא", "סבא", "סבתא" -> Family group, usually safe context.
- Contains "וועד", "ועד", "בניין", "שכנים" -> Neighbors/building committee, NOT close friends.
- Contains "כיתה", "הורים", "מורה", "בי״ס", "בית ספר", "גן" -> School/parents group, formal context.
- Contains "עבודה", "צוות", "משרד" -> Work group, formal context.
- Informal/playful names ("קיפי שלנו", "החבר'ה", nicknames, emojis) -> Likely friend group.

SCORING GUIDELINES (CONTENT vs RELATIONSHIP & HISTORY):
- Content is always primary. Relationship context and alert history modify risk, but do NOT erase repeated aggression.

Guidelines:
1. Friend group (informal name) + playful/joking tone, one-off:
   - You may REDUCE risk by ~30–50 points using relationship_modifier.
   - Friends joking once is usually NOT bullying.
2. Formal/institutional group + aggressive content:
   - Still concerning. You may reduce by ~10–20 points if context is ambiguous.
3. Unknown/new contact (total_messages < 5) + aggressive or sexual content:
   - KEEP or INCREASE risk. Unknown contacts are serious concern.
4. Family group + light banter:
   - Often safe. You may reduce risk by ~40–60 points when consistent with the tone.
5. Private chat + high message history (50+ messages, 5+ days) with mutual tone:
   - Likely established relationship. Moderate reduction (~15–25 points) is allowed.
6. Private chat + very low history (< 5 messages):
   - New contact. Be more cautious.

IMPORTANT:
- "אתה זבל" from a best friend in a familiar group, once, with mutual joking tone:
  - Might end as risk_score ~15 ("safe" or low "monitor").
- "אתה זבל" from an unknown number in private:
  - Could be risk_score ~65 ("review").
- Repeated humiliation, pressure, or threats against the child, even in a friend group:
  - DO NOT neutralize the risk just because they are "friends".
  - Repeated aggression among friends is still bullying.

────────────────────────────────
AUTHOR & TARGET ANALYSIS (CRITICAL)
────────────────────────────────
- The CHILD is the monitored person.
- You know "Author type of flagged message: CHILD/OTHER/UNKNOWN" as a hint.
- In the transcript, messages include names; you must infer who is being attacked, supported, or ignored.

When scoring risk, consider WHO said what and WHO is the target:

1. Message BY the child containing dangerous, humiliating, or exploitative content:
   - HIGH involvement risk (child as sender).
2. Message TO the child that is threatening, humiliating, or exploitative:
   - HIGH involvement risk (child as target).
3. Message BY another person ABOUT a third party (not the child):
   - Lower direct risk for this child (but still monitor overall climate).
4. General group banter, family chat, jokes about unrelated people:
   - Usually lower risk.

Escalation rule:
- Only escalate strongly when the CHILD is directly involved as sender, recipient, or clear target.
- Reduce risk_score by ~30–50 points when the child is neither author nor target in the problematic content (pure bystander), unless the pattern_level is very high and the environment itself is harmful.

────────────────────────────────
PATTERNS FIELD (BEHAVIOR TAGS)
────────────────────────────────
The "patterns" field is NOT for quoting text or listing trigger words.
It is for high-level behavioral tags (in any language, often Hebrew), such as:

- "קללות חוזרות"
- "הדרה חברתית"
- "איום פיזי"
- "לחץ חברתי"
- "שיח מיני מוקדם"
- "פנייה חוזרת ממספר לא מוכר"
- "עידוד לסיכון פיזי"

Rules:
- Do NOT include PII, names, or full message quotes.
- Use 0–5 short strings that capture the behavioral patterns you detected.

────────────────────────────────
AGE & GENDER CONTEXT
────────────────────────────────
You receive child age and gender in the user message (e.g. "Child age: 10, Gender: male").

You MUST:
- Take age into account when scoring severity:
  - Sexual content toward an 8-year-old is far more serious than similar content between 15-year-olds.
  - Violent or self-harm encouragement toward a young child should be scored more severely.
- Use age-appropriate language in "recommendation":
  - For younger children: more parental containment, explanation in simple terms.
  - For older children/teens: more emphasis on dialogue, autonomy, and joint problem-solving.

────────────────────────────────
FINAL OUTPUT SCHEMA (JSON ONLY)
────────────────────────────────
You MUST return JSON ONLY, with EXACTLY these fields:

{
  "risk_score": <number 0..100>,
  "confidence": <number 0.0..1.0>,
  "classification": { 
    "sexual_exploitation": 0.0-1.0,
    "violence_threats": 0.0-1.0,
    "bullying_humiliation": 0.0-1.0,
    "privacy_exploitation": 0.0-1.0,
    "dangerous_extreme_behavior": 0.0-1.0
  },
  "verdict": "safe" | "monitor" | "review" | "notify",
  "patterns": ["<behavior tag>", "..."],
  "title_prefix": "<Hebrew prefix only, NO names>",
  "is_group_chat": true | false,
  "summary": "<Hebrew, 1 concise sentence - primary finding>",
  "context": "<Hebrew, 2-3 sentences - general background>",
  "meaning": "<Hebrew, 1 sentence - direct insight, NEVER start with 'כמו הורה'/'כהורה'/'בתור הורה'>",
  "child_role": "sender" | "target" | "bystander" | "unknown",
  "social_context": {
    "label": "הקשר חברתי",
    "description": "<Hebrew, 1 sentence describing the social dynamic>"
  } | null,
  "recommendation": "<Hebrew, non-empty ONLY if verdict is not 'safe'; otherwise ''>",
  "positive_behavior": {
    "detected": true,
    "type": "empathy" | "leadership" | "maturity" | "helpfulness" | "defense" | "expression",
    "summary": "<Hebrew, 1 sentence describing the positive behavior>",
    "parent_note": "<Hebrew, 1-2 sentences suggesting how the parent can reinforce this strength>"
  } | null
}

Remember:
- Do NOT output any extra fields.
- Do NOT wrap this JSON in markdown.
- When no positive behavior is found, "positive_behavior" MUST be null.
- When verdict = "safe", "recommendation" MUST be "" (empty string).
- For GROUP chats, "social_context" MUST NOT be null. For PRIVATE chats, it MUST be null.`;

// ─── PII Redaction ──────────────────────────────────────────────────────────
const HEBREW_NAMES = ["אורי","נועה","דניאל","עידו","מאיה","אייל","שירה","רון","יואב","תמר","איתי","מיכל","ליה","אדם","עמית"];

function redactPII(text: string): string {
  // Phone numbers: Israeli format
  let result = text.replace(/(?:\+972|0)(?:[-\s]?\d){8,9}/g, '[REDACTED_PHONE]');
  // Emails
  result = result.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
  // Hebrew first names
  for (const name of HEBREW_NAMES) {
    result = result.replace(new RegExp(`(?<=^|\\s|[^א-ת])${name}(?=$|\\s|[^א-ת])`, 'g'), '[REDACTED_NAME]');
  }
  return result;
}

// ─── Shared analysis pipeline ───────────────────────────────────────────────
// Used by both queue mode and legacy/HMAC modes.
// Fetches the alert, runs OpenAI, updates DB, sends push notification.
// Returns summary object on success; throws on error.
async function processAlert(
  supabase: ReturnType<typeof createClient>,
  alertId: number,
  openAIApiKey: string,
  supabaseUrl: string,
  supabaseServiceKey: string,
  force = false,
): Promise<Record<string, unknown>> {
  // 1. Fetch alert
  const { data: alert, error: fetchError } = await supabase
    .from('alerts')
    .select('*')
    .eq('id', alertId)
    .single();

  if (fetchError || !alert) {
    throw new Error(`Alert not found: ${alertId}`);
  }

  const content: string | null = alert.content;
  const deviceId: string | null = alert.device_id;
  const isProcessed: boolean = alert.is_processed || false;

  if (isProcessed && !force) {
    console.log(`Alert ${alertId} already processed, skipping`);
    return { message: 'Already processed', alert_id: alertId };
  }

  if (isProcessed && force) {
    console.log(`Alert ${alertId} already processed but force=true, re-analyzing`);
  }

  if (!content) {
    console.log(`Alert ${alertId} has no content, skipping`);
    return { message: 'No content to analyze', alert_id: alertId };
  }

  console.log(`Analyzing alert ${alertId} with content:`, content.substring(0, 200));
  console.log("PII Redaction applied");

  // 2. Fetch child info for anonymous training data
  let childAge: number | null = null;
  let childGender: string | null = null;

  if (deviceId) {
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select('child_id')
      .eq('device_id', deviceId)
      .single();

    if (deviceError) {
      console.log(`Device lookup failed: ${deviceError.message}`);
    } else if (deviceData?.child_id) {
      const { data: childData } = await supabase
        .from('children')
        .select('date_of_birth, gender, subscription_tier, subscription_expires_at')
        .eq('id', deviceData.child_id)
        .single();

      if (childData) {
        // Check subscription tier - skip AI for free users or expired premium
        const tier = childData.subscription_tier || 'free';
        const expiresAt = childData.subscription_expires_at;
        const isExpired = tier === 'premium' && expiresAt && new Date(expiresAt) < new Date();

        if (tier === 'free' || isExpired) {
          // If premium expired, downgrade immediately
          if (isExpired) {
            console.log(`Alert ${alert.id}: premium expired for child ${deviceData.child_id}, downgrading to free`);
            await supabase
              .from('children')
              .update({ subscription_tier: 'free', subscription_expires_at: null } as any)
              .eq('id', deviceData.child_id);
          }
          console.log(`Alert ${alert.id} skipped: child is on free tier`);
          await supabase
            .from('alerts')
            .update({
              is_processed: true,
              ai_verdict: 'skipped_free',
              processing_status: 'skipped_free_tier',
              content: null,
              analyzed_at: new Date().toISOString(),
            })
            .eq('id', alert.id);

          return {
            alertId: alert.id,
            verdict: 'skipped_free',
            skipped: true,
            reason: 'free_tier',
          };
        }

        const birthDate = new Date(childData.date_of_birth);
        const now = new Date();
        childAge = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
        childGender = childData.gender;
        console.log(`Child context: age=${childAge}, gender=${childGender}`);
      }
    }
  }

  // 3. Fetch relationship context from daily_chat_stats
  let totalMessages = 0;
  let activeDays = 0;
  let statsChatType: string | null = null;

  const chatNameForLookup = alert.chat_name;
  const childIdForLookup = alert.child_id;

  if (chatNameForLookup && childIdForLookup) {
    try {
      const { data: chatStats, error: statsError } = await supabase
        .from('daily_chat_stats')
        .select('message_count, stat_date, chat_type')
        .eq('child_id', childIdForLookup)
        .eq('chat_name', chatNameForLookup);

      if (!statsError && chatStats && chatStats.length > 0) {
        totalMessages = chatStats.reduce((sum: number, row: any) => sum + (row.message_count || 0), 0);
        activeDays = new Set(chatStats.map((row: any) => row.stat_date)).size;
        // Use the most common chat_type from stats
        const groupCount = chatStats.filter((r: any) => r.chat_type === 'GROUP').length;
        statsChatType = groupCount > chatStats.length / 2 ? 'GROUP' : chatStats[0].chat_type;

        console.log(`Relationship context: total_messages=${totalMessages}, active_days=${activeDays}, stats_chat_type=${statsChatType}`);
      } else {
        console.log(`No chat stats found for chat_name="${chatNameForLookup}", child_id="${childIdForLookup}"`);
      }
    } catch (statsErr) {
      console.error('Failed to fetch relationship context (non-fatal):', statsErr);
    }
  }

  // 3b. Fetch alert history for this chat (last 7 days)
  let alertHistoryLine = 'Alert history for this chat: 0 alerts in last 7 days, max_risk=0';

  if (childIdForLookup && chatNameForLookup) {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentAlerts, error: historyError } = await supabase
        .from('alerts')
        .select('ai_risk_score')
        .eq('child_id', childIdForLookup)
        .eq('chat_name', chatNameForLookup)
        .gte('created_at', sevenDaysAgo)
        .neq('id', alertId);

      if (!historyError && recentAlerts && recentAlerts.length > 0) {
        const maxRisk = Math.max(...recentAlerts.map((a: any) => a.ai_risk_score ?? 0));
        alertHistoryLine = `Alert history for this chat: ${recentAlerts.length} alerts in last 7 days, max_risk=${maxRisk}`;
      }
      console.log(`Alert history: ${alertHistoryLine}`);
    } catch (histErr) {
      console.error('Failed to fetch alert history (non-fatal):', histErr);
    }
  }

  // Build enriched user message with raw relationship data (let AI interpret)
  const relationshipLine = `Relationship context: total_messages=${totalMessages}, active_days=${activeDays}${statsChatType ? `, chat_type_from_stats=${statsChatType}` : ''}`;
  const chatNameHint = chatNameForLookup ? `Chat name: '${chatNameForLookup}'` : '';
  const childContextLine = (childAge !== null && childGender)
    ? `Child age: ${childAge}, Gender: ${childGender}`
    : '';
  
  const userMessage = [
    'Analyze this message content:',
    `Chat type: ${alert.chat_type || 'UNKNOWN'}`,
    `Author type of flagged message: ${alert.author_type || 'UNKNOWN'}`,
    relationshipLine,
    chatNameHint,
    childContextLine,
    alertHistoryLine,
    '',
    redactPII(content),
  ].filter(Boolean).join('\n');

  // 4. Select model: check child override → parent group → weighted random → fallback
  let selectedModel = 'gpt-4.1'; // fallback
  try {
    const childId = alert.child_id;
    if (childId) {
      // Priority 1: child-level override
      const { data: override } = await supabase
        .from('child_model_override')
        .select('model_name')
        .eq('child_id', childId)
        .maybeSingle();
      if (override?.model_name) {
        selectedModel = override.model_name;
        console.log(`Model override found for child ${childId}: ${selectedModel}`);
      }
    }
    // Priority 2: parent group model
    if (selectedModel === 'gpt-4.1' && alert.child_id) {
      const { data: childRow } = await supabase
        .from('children')
        .select('parent_id')
        .eq('id', alert.child_id)
        .single();
      if (childRow?.parent_id) {
        const { data: parentRow } = await supabase
          .from('parents')
          .select('group_id')
          .eq('id', childRow.parent_id)
          .single();
        if ((parentRow as any)?.group_id) {
          const { data: groupRow } = await supabase
            .from('customer_groups')
            .select('model_name')
            .eq('id', (parentRow as any).group_id)
            .single();
          if ((groupRow as any)?.model_name) {
            selectedModel = (groupRow as any).model_name;
            console.log(`Group model for parent ${childRow.parent_id}: ${selectedModel}`);
          }
        }
      }
    }
    // Priority 3: weighted random from ai_model_config
    if (selectedModel === 'gpt-4.1') {
      const { data: configs } = await supabase
        .from('ai_model_config')
        .select('model_name, weight')
        .gt('weight', 0);
      if (configs && configs.length > 0) {
        const totalWeight = configs.reduce((s: number, c: any) => s + c.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const c of configs) {
          rand -= c.weight;
          if (rand <= 0) { selectedModel = c.model_name; break; }
        }
      }
    }
  } catch (e) { console.warn('Model selection fallback:', e); }

  console.log(`Using model: ${selectedModel} for alert analysis`);
  const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!openAIResponse.ok) {
    const errorText = await openAIResponse.text();
    console.error('OpenAI API error:', openAIResponse.status, errorText);
    throw new Error(`OpenAI API error: ${openAIResponse.status}`);
  }

  const openAIData = await openAIResponse.json();
  const aiContent = openAIData.choices?.[0]?.message?.content;
  if (!aiContent) {
    throw new Error('No content in OpenAI response');
  }

  const aiResult = JSON.parse(aiContent);
  console.log('Parsed AI result:', JSON.stringify(aiResult, null, 2));

  // Verdict guard: enforce risk_score -> verdict mapping
  function deriveVerdictFromScore(score: number | null): string | null {
    if (typeof score !== 'number') return null;
    if (score <= 24) return 'safe';
    if (score <= 59) return 'monitor';
    if (score <= 79) return 'review';
    return 'notify';
  }

  const mappedVerdict = deriveVerdictFromScore(aiResult.risk_score ?? null);
  if (mappedVerdict && aiResult.verdict !== mappedVerdict) {
    console.log(`Verdict mismatch: model=${aiResult.verdict}, mapped=${mappedVerdict} – overriding`);
    aiResult.verdict = mappedVerdict;
  }

  // 4. Copy to anonymous training_dataset
  const { error: trainingError } = await supabase
    .from('training_dataset')
    .insert({
      alert_id: alertId,
      age_at_incident: childAge,
      gender: childGender,
      raw_text: content,
      ai_verdict: aiResult,
    });

  if (trainingError) {
    console.error('Training dataset insert error:', trainingError);
  }

  // 5. Build title with smart chat_type fallback
  const { data: alertRecord } = await supabase
    .from('alerts')
    .select('chat_name, chat_type')
    .eq('id', alertId)
    .single();

  let chatName = alertRecord?.chat_name || 'איש קשר';
  chatName = chatName
    .replace(/\s*\(\d+\s*הודעות?\)\s*$/i, '')
    .replace(/\s*\(\d+\s*messages?\)\s*$/i, '')
    .trim();

  // Smart chat_type resolution: DB -> AI detection -> daily_chat_stats
  let resolvedChatType = alertRecord?.chat_type || 'PRIVATE';
  
  // If DB says PRIVATE but AI detected group chat, trust the AI
  if (resolvedChatType === 'PRIVATE' && aiResult.is_group_chat === true) {
    console.log(`chat_type OVERRIDE: DB says PRIVATE but AI detected GROUP for "${chatName}"`);
    resolvedChatType = 'GROUP';
  }
  
  // If still PRIVATE but daily_chat_stats says GROUP, trust the stats
  if (resolvedChatType === 'PRIVATE' && statsChatType === 'GROUP') {
    console.log(`chat_type OVERRIDE: DB says PRIVATE but daily_chat_stats says GROUP for "${chatName}"`);
    resolvedChatType = 'GROUP';
  }

  // Update the alert's chat_type if it was corrected
  if (resolvedChatType !== alertRecord?.chat_type) {
    await supabase
      .from('alerts')
      .update({ chat_type: resolvedChatType })
      .eq('id', alertId);
    console.log(`Updated alert ${alertId} chat_type from ${alertRecord?.chat_type} to ${resolvedChatType}`);
  }

  const isGroupChat = resolvedChatType === 'GROUP';

  // CHILD_ROLE GUARD: Iron rule – private chats cannot have bystander
  if (!isGroupChat && aiResult.child_role === 'bystander') {
    console.log(`CHILD_ROLE_GUARD: Overriding bystander -> unknown for PRIVATE chat, alert_id=${alertId}`);
    aiResult.child_role = 'unknown';
  }

  const titlePrefix = aiResult.title_prefix || 'שיחה';
  const finalTitle = `${titlePrefix} — ${chatName}`;

  console.log(`Built title: "${finalTitle}" from prefix: "${titlePrefix}", resolvedChatType: ${resolvedChatType}, isGroup: ${isGroupChat}, chatName: "${chatName}"`);

  // 6. Clean social_context (v2.0: no participants array, just label+description)
  let cleanedSocialContext = aiResult.social_context;

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

  // 7. Update alert in DB (wipe content for privacy)
  // Determine initial processing_status based on verdict
  const initialStatus = (aiResult.verdict === 'notify' || aiResult.verdict === 'review') 
    ? 'analyzed' // Will be updated to 'notified', 'grouped', or 'daily_cap' below
    : 'analyzed'; // Safe/monitor verdicts stay as 'analyzed'

  const updateData = {
    ai_summary: aiResult.summary || null,
    ai_recommendation: aiResult.recommendation || null,
    ai_risk_score: typeof aiResult.risk_score === 'number' ? aiResult.risk_score : null,
    ai_verdict: aiResult.verdict || null,
    ai_title: finalTitle,
    ai_context: aiResult.context || null,
    ai_meaning: aiResult.meaning || null,
    ai_social_context: cleanedSocialContext,
    child_role: aiResult.child_role || null,
    is_processed: true,
    processing_status: initialStatus,
    content: '[CONTENT DELETED FOR PRIVACY]',
    analyzed_at: new Date().toISOString(),
    source: 'edge_analyze_alert',
    ai_analysis: { ...aiResult, model_used: selectedModel },  // Store full AI response for QA + model tracking
    ai_patterns: aiResult.patterns || null,
    ai_classification: aiResult.classification || null,
    ai_confidence: typeof aiResult.confidence === 'number' ? aiResult.confidence : null,
  };

  const { error: updateError } = await supabase
    .from('alerts')
    .update(updateData)
    .eq('id', alertId);

  if (updateError) {
    throw new Error(`Failed to update alert: ${updateError.message}`);
  }

  console.log(`ANALYZE_ALERT_OK alert_id=${alertId}`);

  // 8. Send push notification if verdict is notify or review (with anti-spam)
  if (aiResult.verdict === 'notify' || aiResult.verdict === 'review') {
    try {
      const { data: alertData } = await supabase
        .from('alerts')
        .select('child_id, chat_name')
        .eq('id', alertId)
        .single();

      if (alertData?.child_id) {
        // ── Anti-Spam: Chat Grouping (10-minute window, risk-aware) ──
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
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
          console.log(`ANTI_SPAM: Grouping alert ${alertId} (score ${currentRiskScore}) – same chat within 10min, max recent score ${maxRecentScore}`);
          const { error: groupErr } = await supabase
            .from('alerts')
            .update({ processing_status: 'grouped', should_alert: false })
            .eq('id', alertId);
          if (groupErr) console.error(`Failed to update grouped status for alert ${alertId}:`, groupErr);

          return {
            success: true,
            alert_id: alertId,
            status: 'grouped',
            ai_verdict: updateData.ai_verdict,
            privacy: 'content_wiped',
          };
        }

        // ── Anti-Spam: Daily Cap (10 per child per day) ──
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const { count: dailyCount } = await supabase
          .from('alerts')
          .select('id', { count: 'exact', head: true })
          .eq('child_id', alertData.child_id)
          .eq('should_alert', true)
          .gte('analyzed_at', todayStart.toISOString())
          .neq('id', alertId);

        if ((dailyCount ?? 0) >= 10) {
          console.log(`ANTI_SPAM: Daily cap for child ${alertData.child_id}, alert ${alertId}`);
          const { error: capErr } = await supabase
            .from('alerts')
            .update({ processing_status: 'daily_cap', should_alert: false })
            .eq('id', alertId);
          if (capErr) console.error(`Failed to update daily_cap status for alert ${alertId}:`, capErr);

          return {
            success: true,
            alert_id: alertId,
            status: 'daily_cap',
            ai_verdict: updateData.ai_verdict,
            privacy: 'content_wiped',
          };
        }

        // ── Send push notification ──
        const { data: childData } = await supabase
          .from('children')
          .select('parent_id, name')
          .eq('id', alertData.child_id)
          .single();

        if (childData?.parent_id) {
          console.log(`Sending push notification to parent ${childData.parent_id}`);

          const { error: notifyErr } = await supabase
            .from('alerts')
            .update({ processing_status: 'notified' })
            .eq('id', alertId);
          if (notifyErr) console.error(`Failed to update notified status for alert ${alertId}:`, notifyErr);

          const pushResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-push-notification`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                parent_id: childData.parent_id,
                title: updateData.ai_title || 'התראה חדשה מ-Kippy',
                body: updateData.ai_summary || 'נמצא תוכן שדורש את תשומת לבך',
                url: '/alerts',
                alert_id: alertId,
                child_name: childData.name,
              }),
            }
          );

          const pushResult = await pushResponse.json();
          console.log('Push notification result:', pushResult);
        }
      }
    } catch (pushError) {
      console.error('Push notification error (non-fatal):', pushError);
    }
  }

  // 9. Handle positive behavior detection
  if (aiResult.positive_behavior?.detected === true) {
    try {
      console.log(`POSITIVE_BEHAVIOR detected for alert ${alertId}: type=${aiResult.positive_behavior.type}`);
      
      // Get child_id from the alert
      const { data: alertForPositive } = await supabase
        .from('alerts')
        .select('child_id, device_id, chat_name, chat_type')
        .eq('id', alertId)
        .single();

      if (alertForPositive?.child_id) {
        // Create a separate positive alert record
        const positiveTitle = `כל הכבוד! ${aiResult.positive_behavior.summary}`;
        
        const { error: positiveError } = await supabase
          .from('alerts')
          .insert({
            child_id: alertForPositive.child_id,
            device_id: alertForPositive.device_id,
            chat_name: alertForPositive.chat_name,
            chat_type: alertForPositive.chat_type,
            alert_type: 'positive',
            ai_verdict: 'positive',
            ai_title: positiveTitle,
            ai_summary: aiResult.positive_behavior.summary,
            ai_recommendation: aiResult.positive_behavior.parent_note,
            ai_risk_score: 0,
            is_processed: true,
            processing_status: 'analyzed',
            content: '[CONTENT DELETED FOR PRIVACY]',
            analyzed_at: new Date().toISOString(),
            source: 'edge_analyze_alert',
            category: aiResult.positive_behavior.type,
          });

        if (positiveError) {
          console.error(`Failed to create positive alert: ${positiveError.message}`);
        } else {
          console.log(`POSITIVE_ALERT_CREATED for child ${alertForPositive.child_id}`);
        }
      }
    } catch (positiveErr) {
      console.error('Positive behavior handling error (non-fatal):', positiveErr);
    }
  }

  return {
    success: true,
    alert_id: alertId,
    ai_summary: updateData.ai_summary,
    ai_recommendation: updateData.ai_recommendation,
    ai_risk_score: updateData.ai_risk_score,
    ai_verdict: updateData.ai_verdict,
    positive_behavior: aiResult.positive_behavior || null,
    privacy: 'content_wiped',
  };
}

// ─── Main handler ───────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rawBody = await req.text();

  // Parse body safely – empty body is valid (queue mode)
  let body: Record<string, unknown> = {};
  if (rawBody && rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUEUE MODE – empty body, empty object, or { mode: 'queue' }
  // ═══════════════════════════════════════════════════════════════════════════
  const isQueueMode =
    !rawBody ||
    !rawBody.trim() ||
    Object.keys(body).length === 0 ||
    body.mode === 'queue';

  if (isQueueMode) {
    console.log('QUEUE_MODE: Entering queue worker mode');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration: missing env vars' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Claim one pending job
    const { data: jobs, error: claimError } = await supabase.rpc('claim_alert_events', {
      _event_type: 'ai_analyze',
      _limit: 1,
      _lease_seconds: 60,
    });

    if (claimError) {
      console.error('QUEUE_MODE: claim_alert_events RPC error:', claimError);
      return new Response(
        JSON.stringify({ error: 'Failed to claim job', detail: claimError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!jobs || jobs.length === 0) {
      console.log('QUEUE_MODE: No pending jobs');
      return new Response(
        JSON.stringify({ status: 'no_jobs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const job = jobs[0];
    const queueId = job.id;
    const alertId = job.alert_id;
    console.log(`QUEUE_MODE: Claimed job ${queueId} for alert_id=${alertId}, attempt=${job.attempt}`);

    try {
      const result = await processAlert(supabase, alertId, openAIApiKey, supabaseUrl, supabaseServiceKey);

      // Mark queue job as succeeded
      await supabase
        .from('alert_events_queue')
        .update({ status: 'succeeded', last_error: null, updated_at: new Date().toISOString() })
        .eq('id', queueId);

      console.log(`QUEUE_MODE: Job ${queueId} succeeded for alert_id=${alertId}`);
      return new Response(
        JSON.stringify({ status: 'succeeded', alert_id: alertId, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      const errMsg = String(err).slice(0, 400);
      console.error(`QUEUE_MODE: Job ${queueId} failed for alert_id=${alertId}: ${errMsg}`);

      // Mark queue job as failed
      await supabase
        .from('alert_events_queue')
        .update({ status: 'failed', last_error: errMsg, updated_at: new Date().toISOString() })
        .eq('id', queueId);

      // Also update the alert's processing status
      await supabase
        .from('alerts')
        .update({ processing_status: 'failed', last_error: errMsg })
        .eq('id', alertId);

      return new Response(
        JSON.stringify({ status: 'failed', error: errMsg, alert_id: alertId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY MODES – webhook (INSERT) and direct HMAC call (alert_id)
  // ═══════════════════════════════════════════════════════════════════════════
  let alertId: number | undefined;

  try {
    const webhookSecret = Deno.env.get('KIPPY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('ANALYZE_ALERT_FAIL reason=KIPPY_WEBHOOK_SECRET_NOT_CONFIGURED');
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const signature = req.headers.get('X-Kippy-Signature');

    let content: string | null = null;
    let isProcessed = false;
    let deviceId: string | null = null;

    if (body.type === 'INSERT' && body.record) {
      // Database webhook format (legacy)
      const record = body.record as Record<string, unknown>;
      alertId = record.id as number;
      content = record.content as string | null;
      isProcessed = (record.is_processed as boolean) || false;
      deviceId = record.device_id as string | null;
    } else if (body.alert_id) {
      // Direct call format with HMAC
      alertId = body.alert_id as number;
    } else {
      console.error('ANALYZE_ALERT_FAIL reason=INVALID_REQUEST_FORMAT');
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // HMAC verification
    if (signature) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const alertIdString = String(alertId);
      const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(alertIdString));
      const expectedSignature = Array.from(new Uint8Array(signatureBytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (signature.length !== expectedSignature.length) {
        console.error(`ANALYZE_ALERT_FAIL alert_id=${alertId} reason=INVALID_SIGNATURE_LENGTH`);
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let mismatch = 0;
      for (let i = 0; i < signature.length; i++) {
        mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
      }
      if (mismatch !== 0) {
        console.error(`ANALYZE_ALERT_FAIL alert_id=${alertId} reason=INVALID_SIGNATURE`);
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Signature verified for alert_id=${alertId}`);
    }

    // For legacy webhook INSERT with already-processed check
    if (isProcessed && body.type === 'INSERT') {
      console.log(`Alert ${alertId} already processed, skipping`);
      return new Response(
        JSON.stringify({ message: 'Already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey) throw new Error('OPENAI_API_KEY is not configured');
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase credentials are not configured');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Use the shared processAlert helper (support force re-analyze)
    const force = body.force === true;
    const result = await processAlert(supabase, alertId!, openAIApiKey, supabaseUrl, supabaseServiceKey, force);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`ANALYZE_ALERT_FAIL alert_id=${alertId || 'unknown'} reason=${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
