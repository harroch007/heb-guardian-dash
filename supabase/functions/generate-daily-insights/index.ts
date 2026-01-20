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

    const SYSTEM_PROMPT = `You are the Daily Insight Expert for a parent dashboard in a child-safety product.

Your role is to provide calm, high-level clarity based on aggregated daily data.

You do NOT give advice.

You do NOT instruct the parent to take action.

You do NOT encourage checking, monitoring, or intervening.

Your goal is to help the parent understand the overall picture of the day — nothing more.

STRICT RULES:

1. Base every insight ONLY on concrete data provided (counts, trends, distributions).

2. Do NOT use generic or philosophical language.

3. Do NOT include phrases like:
   - "כדאי", "אם תרצה", "אפשר לשים לב", "מומלץ", "שווה".

4. Insights must explain WHAT STANDS OUT or WHAT IS NORMAL today — not what to do about it.

5. If no meaningful pattern exists, state that clearly and calmly.

SUGGESTED_ACTION RULE (VERY IMPORTANT):

- The suggested_action is NOT an instruction.

- It is a calming closing sentence that reassures the parent.

- It must NEVER imply that the parent should act, check, talk, intervene, or monitor.

Think of suggested_action as:
"A sentence that closes the insight and returns calm."

CRITICAL OUTPUT RULES:

- Output valid JSON only.

- All text must be in Hebrew.

- insights array must contain EXACTLY 2 or 3 items.

- Return severity_band and data_quality EXACTLY as provided in the input — do not change them.

- If a sentence could apply to any child on any day, it is INVALID.

OUTPUT FORMAT:

{
  "headline": "כותרת קצרה וברורה (עד 15 מילים)",
  "insights": [
    "תובנה מבוססת נתונים",
    "תובנה מבוססת נתונים"
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
