import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InsightResponse {
  headline: string;
  insights: string[];
  suggested_action: string;
  severity_band: 'calm' | 'watch' | 'intense';
  data_quality: 'good' | 'partial' | 'insufficient';
}

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

    // 3. Calculate day_of_week from date (0 = Sunday, 6 = Saturday)
    const dateObj = new Date(date + 'T00:00:00Z');
    const dayOfWeek = dateObj.getUTCDay();

    // 4. Compute "today" in Israel timezone
    const israelNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    const todayIsrael = israelNow.toISOString().split("T")[0];
    const isToday = (date === todayIsrael);

    // 5. Check for existing cached insight with matching date
    // Use service role client for DB operations (RLS bypass for insert/update)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: cachedInsight, error: cacheError } = await serviceClient
      .from('child_daily_insights')
      .select('*')
      .eq('child_id', child_id)
      .eq('day_of_week', dayOfWeek)
      .eq('insight_date', date)
      .maybeSingle();

    if (cacheError) {
      console.error('Cache lookup error:', cacheError.message);
    }

    // Helper function to log insight requests
    const logInsightRequest = async (requestType: string) => {
      try {
        await serviceClient.from('insight_logs').insert({
          child_id,
          insight_date: date,
          request_type: requestType,
          is_today: isToday
        });
      } catch (e) {
        console.error('Failed to log insight request:', e);
      }
    };

    // 6. Decision logic: return cached or regenerate
    let shouldRegenerate = true;

    if (cachedInsight) {
      if (!isToday) {
        // PAST DATE: return if conclusive, otherwise regenerate
        if (cachedInsight.is_conclusive) {
          console.log('Returning conclusive cached insight for child:', child_id, 'date:', date);
          await logInsightRequest('cached_conclusive');
          return new Response(JSON.stringify({
            headline: cachedInsight.headline,
            insights: cachedInsight.insights,
            suggested_action: cachedInsight.suggested_action,
            severity_band: cachedInsight.severity_band,
            data_quality: cachedInsight.data_quality,
            is_conclusive: true,
            cached: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        // Partial insight for past date -> regenerate as conclusive
        console.log('Upgrading partial insight to conclusive for child:', child_id, 'date:', date);
        shouldRegenerate = true;
      } else {
        // TODAY: check time-based rules
        const createdAt = new Date(cachedInsight.created_at);
        const hoursSinceCreation = (Date.now() - createdAt.getTime()) / 3600000;
        
        // Get creation time in Israel timezone
        const createdInIsrael = new Date(createdAt.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
        const createdHour = createdInIsrael.getHours();
        const createdMinute = createdInIsrael.getMinutes();
        
        if (hoursSinceCreation < 1) {
          // Too recent - return cached
          console.log('Returning recent cached insight (< 1hr) for child:', child_id, 'date:', date);
          await logInsightRequest('cached_recent');
          shouldRegenerate = false;
        } else if (createdHour >= 23 && createdMinute >= 55) {
          // Created very late (23:55+) - don't regenerate before midnight
          console.log('Returning late-night cached insight for child:', child_id, 'date:', date);
          await logInsightRequest('cached_late_night');
          shouldRegenerate = false;
        } else {
          // More than 1 hour old and not late-night - regenerate
          console.log('Regenerating insight (> 1hr old) for child:', child_id, 'date:', date);
          shouldRegenerate = true;
        }
        
        if (!shouldRegenerate) {
          return new Response(JSON.stringify({
            headline: cachedInsight.headline,
            insights: cachedInsight.insights,
            suggested_action: cachedInsight.suggested_action,
            severity_band: cachedInsight.severity_band,
            data_quality: cachedInsight.data_quality,
            is_conclusive: false,
            cached: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Log new generation or upgrade
    const generationType = cachedInsight ? 'generated_upgrade' : 'generated_new';
    console.log(`${generationType} for child:`, child_id, 'date:', date);
    await logInsightRequest(generationType);

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

    // 6. Compute severity_band (server-side only)
    const alerts_sent = metrics?.alerts_sent ?? 0;
    severity_band = alerts_sent === 0 ? 'calm' 
      : alerts_sent <= 3 ? 'watch' 
      : 'intense';

    // 7. Compute data_quality (server-side only)
    const metricsExist = metrics && (
      metrics.messages_scanned > 0 || 
      metrics.stacks_sent_to_ai > 0 || 
      metrics.alerts_sent > 0
    );
    const hasTopData = (topChats?.length > 0) || (topApps?.length > 0);

    data_quality = !metricsExist ? 'insufficient'
      : !hasTopData ? 'partial'
      : 'good';

    // 8. Build payload (exact structure)
    const payload = {
      window: { date, timezone: 'Asia/Jerusalem' },
      metrics: {
        messages_scanned: metrics?.messages_scanned ?? 0,
        ai_sent: metrics?.stacks_sent_to_ai ?? 0,
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

    // 9. Call OpenAI with DAILY_INSIGHT_AI_KEY
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

    const parsed = JSON.parse(content) as InsightResponse;
    
    // Validate insights is an array (AI sometimes returns string instead)
    if (!Array.isArray(parsed.insights)) {
      console.error('AI returned insights as non-array:', typeof parsed.insights);
      parsed.insights = parsed.insights 
        ? [String(parsed.insights)] 
        : ["לא ניתן היה לייצר תובנות מפורטות"];
    }
    
    // Ensure severity_band and data_quality are not modified by AI
    parsed.severity_band = severity_band;
    parsed.data_quality = data_quality;

    // Determine if this insight is conclusive (past date = true, today = false)
    const isConclusive = !isToday;

    // 10. Save to database (UPSERT - will overwrite old day_of_week entry)
    const { error: upsertError } = await serviceClient
      .from('child_daily_insights')
      .upsert({
        child_id,
        day_of_week: dayOfWeek,
        insight_date: date,
        is_conclusive: isConclusive,
        headline: parsed.headline,
        insights: parsed.insights,
        suggested_action: parsed.suggested_action || '',
        severity_band: parsed.severity_band,
        data_quality: parsed.data_quality
      }, {
        onConflict: 'child_id,day_of_week'
      });

    if (upsertError) {
      console.error('Failed to cache insight:', upsertError.message);
      // Continue anyway - return the insight even if caching failed
    } else {
      console.log('Cached new insight for child:', child_id, 'date:', date, 'dow:', dayOfWeek);
    }

    return new Response(JSON.stringify({
      ...parsed,
      is_conclusive: isConclusive,
      cached: false
    }), {
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
