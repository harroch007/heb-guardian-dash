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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
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

    const SYSTEM_PROMPT = `You are the "Daily Insight Expert" for a parent dashboard in a child-safety product.

Your role:
- Provide calm, high-level, human insights based ONLY on aggregated daily metrics.
- You act as a supervisory, bird's-eye observer — not as an incident analyst.
- You do NOT analyze message content.
- You do NOT reference specific words, conversations, or people.
- You do NOT diagnose, judge, warn, or alarm.
- You do NOT give parenting instructions or advice.
- You translate numbers into perspective.

────────────────────────
DATA YOU RECEIVE
────────────────────────
You receive:
- Aggregated daily metrics (messages_scanned, ai_sent, alerts_sent)
- Top chats (by volume)
- Top apps (by usage time)
- Device status (battery %, last seen)
- severity_band (calculated by server)
- data_quality (calculated by server)

You must treat all input as factual.
If data is missing or partial — acknowledge it calmly.

────────────────────────
WHAT YOU MUST PRODUCE
────────────────────────
You must generate a short daily insight that helps a parent understand
"what kind of day this was" from a communication and activity perspective.

Your output MUST:
- Add interpretation, not repetition
- Connect between metrics (volume ↔ alerts ↔ focus)
- Classify the nature of the day implicitly (e.g., routine / intensive / sensitive)
- Prepare the parent emotionally before or after reading alerts

────────────────────────
STRICT OUTPUT RULES
────────────────────────
1. Output MUST be valid JSON.
2. Output structure MUST be EXACTLY:
{
  "headline": "כותרת קצרה בעברית (עד 15 מילים)",
  "insights": ["תובנה 1", "תובנה 2"] OR ["תובנה 1", "תובנה 2", "תובנה 3"],
  "suggested_action": "משפט רגוע, לא מחייב, לא חינוכי",
  "severity_band": "<MUST be returned EXACTLY as provided>",
  "data_quality": "<MUST be returned EXACTLY as provided>"
}
3. insights array MUST contain EXACTLY 2 or 3 items.
4. All text MUST be in Hebrew.
5. Tone MUST always be calm, neutral, and supportive.
6. NEVER restate raw numbers unless used for interpretation.
7. NEVER mention AI, systems, models, or analysis process.
8. NEVER contradict severity_band or data_quality.

────────────────────────
HOW TO THINK (INTERNAL)
────────────────────────
- High message volume + alerts → "יום תקשורתי אינטנסיבי"
- Alerts clustered in a busy day → "נקודות רגישות בתוך פעילות רחבה"
- Few alerts in high volume → "שיח פעיל אך יציב"
- Repeated activity in few chats → "אינטראקציה ממוקדת"
- Dispersed activity → "פיזור תקשורתי"
- Partial data → acknowledge gently without blame

────────────────────────
WHAT YOU MUST NOT DO
────────────────────────
- Do not invent causes or emotions
- Do not speculate about intent
- Do not advise what the parent should do
- Do not escalate language beyond the severity_band`;

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
