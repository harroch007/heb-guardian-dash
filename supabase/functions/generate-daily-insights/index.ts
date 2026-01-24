import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Defaults - will be updated if we get far enough
  let severity_band: 'calm' | 'watch' | 'intense' = 'calm';
  let data_quality: 'good' | 'partial' | 'insufficient' = 'insufficient';

  try {
    // 1. Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      console.error('Auth error:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 2. Get parameters
    const { child_id, date } = await req.json();

    if (!child_id || !date) {
      return new Response(JSON.stringify({ error: 'Missing child_id or date' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 3. Fetch data
    const { data: metricsData } = await supabase.rpc('get_child_daily_metrics', {
      p_child_id: child_id, 
      p_date: date
    });
    const metrics = metricsData?.[0] ?? null;

    const { data: topChats } = await supabase.rpc('get_child_top_contacts', {
      p_child_id: child_id, 
      p_date: date, 
      p_limit: 5
    });

    const { data: topApps } = await supabase.rpc('get_child_top_apps', {
      p_child_id: child_id, 
      p_date: date, 
      p_limit: 5
    });

    // Fetch device_status
    const { data: deviceData } = await supabase
      .from('devices')
      .select('battery_level, last_seen')
      .eq('child_id', child_id)
      .order('last_seen', { ascending: false })
      .limit(1)
      .maybeSingle();

    let lastSeenMinutesAgo: number | null = null;
    if (deviceData?.last_seen) {
      const lastSeenDate = new Date(deviceData.last_seen);
      const now = new Date();
      lastSeenMinutesAgo = Math.floor((now.getTime() - lastSeenDate.getTime()) / 60000);
    }

    // 4. Compute severity_band (server-side only)
    const alerts_sent = metrics?.alerts_sent ?? 0;
    severity_band = alerts_sent === 0 ? 'calm' 
      : alerts_sent <= 3 ? 'watch' 
      : 'intense';

    // 5. Compute data_quality (server-side only)
    const metricsExist = metrics && (
      metrics.messages_scanned > 0 || 
      metrics.stacks_sent_to_ai > 0 || 
      metrics.alerts_sent > 0
    );
    const hasTopData = (topChats?.length > 0) || (topApps?.length > 0);

    data_quality = !metricsExist ? 'insufficient'
      : !hasTopData ? 'partial'
      : 'good';

    // 6. Build payload (exact structure)
    const payload = {
      window: { date, timezone: 'Asia/Jerusalem' },
      metrics: {
        messages_scanned: metrics?.messages_scanned ?? 0,
        ai_sent: metrics?.stacks_sent_to_ai ?? 0,  // mapped from stacks_sent_to_ai
        alerts_sent: metrics?.alerts_sent ?? 0
      },
      top_chats: topChats?.slice(0, 5) ?? [],
      top_apps: topApps?.slice(0, 5) ?? [],
      device_status: {
        battery_percent: deviceData?.battery_level ?? null,
        last_seen_minutes_ago: lastSeenMinutesAgo
      },
      severity_band,
      data_quality
    };

    // 7. Call OpenAI with DAILY_INSIGHT_AI_KEY
    const DAILY_INSIGHT_AI_KEY = Deno.env.get('DAILY_INSIGHT_AI_KEY');
    if (!DAILY_INSIGHT_AI_KEY) {
      console.error('DAILY_INSIGHT_AI_KEY not configured');
      return new Response(JSON.stringify({
        headline: "לא ניתן לייצר תובנות כרגע",
        insights: ["אנא נסה שוב מאוחר יותר", "אם התקלה נמשכת, נסה בעוד כמה דקות"],
        suggested_action: "",
        severity_band,
        data_quality
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const SYSTEM_PROMPT = `You are the Daily Insight Expert for a parent dashboard in a child-safety product.

Your role is to give parents CLARITY — not to reflect numbers they already see on their screen.

THE GOLDEN RULE: If a sentence just repeats a number, it is NOT an insight.

❌ BAD (just repeating data):
- "נשלחו 70 הודעות היום"
- "היו 3 התראות"
- "השימוש העיקרי היה ב-WhatsApp"

✅ GOOD (providing clarity):
- "פעילות תקשורת שגרתית - רוב ההודעות בשיחות עם אנשי קשר קבועים"
- "יום פעיל מהרגיל בתקשורת - ייתכן שמשהו מיוחד קרה בחברה"
- "ההתראות הגיעו בעיקר משיחות קבוצתיות - דפוס נפוץ בגיל הזה"

YOUR INSIGHTS MUST ANSWER:
1. Is this a typical day or unusual? Why?
2. What patterns or trends stand out?
3. What's the overall "flavor" of today's activity?

STRICT RULES:

1. NEVER mention specific numbers — the parent already sees them in the Digital Activity card.

2. Provide CONTEXT and PERSPECTIVE, not data reflection.

3. Explain what makes today unique (or confirm it's routine).

4. Do NOT use generic sentences that could apply to any child on any day.

5. Do NOT give advice, instructions, or action items.

6. Do NOT use phrases like: "כדאי", "מומלץ", "שווה לשים לב", "אפשר לבדוק".

EXAMPLES BY DAY TYPE:

Routine day:
- "פעילות תקשורת שגרתית - רוב הזמן הושקע בשיחות עם אנשי קשר קבועים"
- "האפליקציות הפעילות ביותר הן ערוצי תקשורת מוכרים"

Intensive day:
- "יום פעיל מהרגיל בתקשורת - נצפתה פעילות מוגברת בצ'אטים קבוצתיים"
- "ריבוי שיחות בשעות הערב - ייתכן שמתרחש משהו בחברה"

Calm day:
- "יום שקט יחסית - פעילות מופחתת בכל הערוצים"
- "רוב הזמן הוקדש לתוכן בידורי ופחות לתקשורת"

Regarding alerts:
- "ההתראות היום הגיעו בעיקר משיחות קבוצתיות - דפוס נפוץ"
- "ההתראות היו בנושאים שונים ללא דפוס חוזר"

SUGGESTED_ACTION RULE:
- NOT an instruction — it's a calming closing sentence.
- Must NEVER imply the parent should act, check, or intervene.
- Think of it as: "A sentence that closes the insight and restores calm."

CRITICAL OUTPUT RULES:
- Output valid JSON only.
- All text must be in Hebrew.
- insights array must contain EXACTLY 2 or 3 items.
- Return severity_band and data_quality EXACTLY as provided — do not change them.

OUTPUT FORMAT:
{
  "headline": "כותרת קצרה שמסכמת את אופי היום (עד 10 מילים)",
  "insights": [
    "תובנה שנותנת הקשר ופרספקטיבה",
    "תובנה שמסבירה מה מייחד את היום"
  ],
  "suggested_action": "משפט מסכם ומרגיע בלבד",
  "severity_band": "",
  "data_quality": ""
}`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAILY_INSIGHT_AI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(payload) }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!openaiResponse.ok) {
      console.error('OpenAI API error:', openaiResponse.status, await openaiResponse.text());
      return new Response(JSON.stringify({
        headline: "לא ניתן לייצר תובנות כרגע",
        insights: ["אנא נסה שוב מאוחר יותר", "אם התקלה נמשכת, נסה בעוד כמה דקות"],
        suggested_action: "",
        severity_band,
        data_quality
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiResult = await openaiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content in OpenAI response');
      return new Response(JSON.stringify({
        headline: "לא ניתן לייצר תובנות כרגע",
        insights: ["אנא נסה שוב מאוחר יותר", "אם התקלה נמשכת, נסה בעוד כמה דקות"],
        suggested_action: "",
        severity_band,
        data_quality
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const parsed = JSON.parse(content);
    
    // Ensure severity_band and data_quality are not modified by AI
    parsed.severity_band = severity_band;
    parsed.data_quality = data_quality;

    console.log('Generated insights successfully for child:', child_id, 'date:', date);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generate-daily-insights:', error);
    // Use computed values (or defaults if we didn't reach computation)
    return new Response(JSON.stringify({
      headline: "לא ניתן לייצר תובנות כרגע",
      insights: ["אנא נסה שוב מאוחר יותר", "אם התקלה נמשכת, נסה בעוד כמה דקות"],
      suggested_action: "",
      severity_band,
      data_quality
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
