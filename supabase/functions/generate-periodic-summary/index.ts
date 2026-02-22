import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PeriodicSummaryResponse {
  headline: string;
  insights: string[];
  suggested_action: string;
  severity_summary: 'calm' | 'mixed' | 'intense';
  positive_highlights: string[];
}

async function generateSummaryForChild(
  serviceClient: any,
  child_id: string,
  period_type: string,
  trigger: string
): Promise<{ success: boolean; skipped?: boolean; reason?: string; headline?: string }> {
  // Calculate period dates in Israel timezone
  const israelNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));

  let period_start: string;
  let period_end: string;

  if (period_type === 'weekly') {
    const endDate = new Date(israelNow);
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    period_start = startDate.toISOString().split('T')[0];
    period_end = endDate.toISOString().split('T')[0];
  } else {
    const endDate = new Date(israelNow);
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    period_start = startDate.toISOString().split('T')[0];
    period_end = endDate.toISOString().split('T')[0];
  }

  // Check for existing summary
  const { data: existing } = await serviceClient
    .from('child_periodic_summaries')
    .select('id')
    .eq('child_id', child_id)
    .eq('period_type', period_type)
    .eq('period_start', period_start)
    .maybeSingle();

  if (existing && trigger === 'cron') {
    console.log(`Summary already exists for ${child_id} ${period_type} ${period_start}, skipping`);
    return { success: true, skipped: true, reason: 'already_exists' };
  }

  // Get child info
  const { data: childData } = await serviceClient
    .from('children')
    .select('name, gender, date_of_birth, parent_id')
    .eq('id', child_id)
    .single();

  if (!childData) {
    return { success: false, reason: 'child_not_found' };
  }

  // Get device_id
  const { data: deviceData } = await serviceClient
    .from('devices')
    .select('device_id')
    .eq('child_id', child_id)
    .order('last_seen', { ascending: false })
    .limit(1)
    .maybeSingle();

  const device_id = deviceData?.device_id;

  // Fetch all data sources in parallel
  const dateFilter = { gte: period_start + 'T00:00:00+03:00', lt: period_end + 'T23:59:59+03:00' };

  const [metricsResult, alertsResult, positiveAlertsResult, appUsageResult, chatStatsResult, insightsResult] = await Promise.all([
    device_id
      ? serviceClient.from('device_daily_metrics')
          .select('metric_date, messages_scanned, stacks_sent_to_ai, alerts_sent')
          .eq('device_id', device_id)
          .gte('metric_date', period_start)
          .lte('metric_date', period_end)
      : Promise.resolve({ data: [] }),
    serviceClient.from('alerts')
      .select('ai_title, category, child_role, chat_type, ai_risk_score, expert_type, created_at')
      .eq('child_id', child_id)
      .eq('alert_type', 'warning')
      .gte('created_at', dateFilter.gte)
      .lt('created_at', dateFilter.lt)
      .not('analyzed_at', 'is', null)
      .eq('processing_status', 'notified')
      .limit(50),
    serviceClient.from('alerts')
      .select('ai_title, category, ai_summary, created_at')
      .eq('child_id', child_id)
      .eq('alert_type', 'positive')
      .gte('created_at', dateFilter.gte)
      .lt('created_at', dateFilter.lt)
      .eq('is_processed', true)
      .limit(20),
    serviceClient.from('app_usage')
      .select('app_name, package_name, usage_minutes, usage_date')
      .eq('child_id', child_id)
      .gte('usage_date', period_start)
      .lte('usage_date', period_end)
      .order('usage_minutes', { ascending: false })
      .limit(100),
    serviceClient.from('daily_chat_stats')
      .select('chat_name, chat_type, message_count, stat_date')
      .eq('child_id', child_id)
      .gte('stat_date', period_start)
      .lte('stat_date', period_end)
      .order('message_count', { ascending: false })
      .limit(100),
    serviceClient.from('child_daily_insights')
      .select('headline, insights, severity_band, insight_date')
      .eq('child_id', child_id)
      .gte('insight_date', period_start)
      .lte('insight_date', period_end)
      .order('insight_date', { ascending: true }),
  ]);

  const metrics = metricsResult.data || [];
  const alerts = alertsResult.data || [];
  const positiveAlerts = positiveAlertsResult.data || [];
  const appUsage = appUsageResult.data || [];
  const chatStats = chatStatsResult.data || [];
  const dailyInsights = insightsResult.data || [];

  // Build stats
  const totalMessages = metrics.reduce((sum: number, m: any) => sum + (m.messages_scanned || 0), 0);
  const daysWithData = metrics.length;

  const appAgg: Record<string, number> = {};
  for (const a of appUsage) {
    appAgg[a.app_name || a.package_name] = (appAgg[a.app_name || a.package_name] || 0) + (a.usage_minutes || 0);
  }
  const topApps = Object.entries(appAgg).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, minutes]) => ({ name, minutes }));

  const contactAgg: Record<string, number> = {};
  for (const c of chatStats) {
    contactAgg[c.chat_name] = (contactAgg[c.chat_name] || 0) + (c.message_count || 0);
  }
  const topContacts = Object.entries(contactAgg).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

  const alertCategories: Record<string, number> = {};
  for (const a of alerts) {
    if (a.category) alertCategories[a.category] = (alertCategories[a.category] || 0) + 1;
  }

  const dayMessages: Record<string, number> = {};
  for (const m of metrics) {
    dayMessages[m.metric_date] = (dayMessages[m.metric_date] || 0) + (m.messages_scanned || 0);
  }
  const busiestDay = Object.entries(dayMessages).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const statsSnapshot = {
    total_messages: totalMessages,
    total_alerts: alerts.length,
    total_positive: positiveAlerts.length,
    avg_daily_messages: daysWithData > 0 ? Math.round(totalMessages / daysWithData) : 0,
    busiest_day: busiestDay,
    top_apps: topApps,
    top_contacts: topContacts,
    alert_categories: alertCategories,
    days_with_data: daysWithData,
  };

  const minRequired = period_type === 'weekly' ? 3 : 15;
  const dataQuality = daysWithData < minRequired ? 'insufficient' : 'good';

  if (dataQuality === 'insufficient') {
    console.log(`Insufficient data for ${child_id} ${period_type}: ${daysWithData}/${minRequired} days`);
    return { success: false, reason: 'insufficient_data', days_with_data: daysWithData, min_required: minRequired };
  }

  // Build AI payload
  const periodLabel = period_type === 'weekly' ? 'שבועי' : 'חודשי';
  const payload = {
    period: { type: period_type, start: period_start, end: period_end, label: periodLabel },
    child: { name: childData.name, gender: childData.gender },
    stats: statsSnapshot,
    alerts_summary: alerts.slice(0, 15).map((a: any) => ({
      title: a.ai_title, category: a.category, child_role: a.child_role, risk_score: a.ai_risk_score,
    })),
    positive_alerts: positiveAlerts.slice(0, 10).map((a: any) => ({
      title: a.ai_title, category: a.category, summary: a.ai_summary,
    })),
    daily_insights: dailyInsights.map((d: any) => ({
      date: d.insight_date, headline: d.headline, severity: d.severity_band,
    })),
    data_quality: dataQuality,
  };

  // Call AI
  const DAILY_INSIGHT_AI_KEY = Deno.env.get('DAILY_INSIGHT_AI_KEY');
  if (!DAILY_INSIGHT_AI_KEY) {
    console.error('DAILY_INSIGHT_AI_KEY not configured');
    return { success: false, reason: 'ai_key_missing' };
  }

  const SYSTEM_PROMPT = `You are the Periodic Summary Expert for a parent dashboard in a child-safety product.

Your role is to analyze TRENDS over a ${period_type === 'weekly' ? 'week' : 'month'} — not individual days.
You help parents see the BIG PICTURE of their child's digital life.

INPUT DATA:
- stats: aggregated metrics for the period (messages, alerts, apps, contacts)
- alerts_summary: significant alerts from the period
- positive_alerts: positive behaviors detected
- daily_insights: daily AI summaries from each day (use as context, not to repeat)

RULES:
1. Focus on PATTERNS and TRENDS, not individual incidents.
2. Compare implicitly — "השבוע היה שקט יחסית" is good, "היו 45 הודעות" is bad.
3. If alerts exist, characterize them by category and frequency, not enumerate.
4. If positive_alerts exist, HIGHLIGHT them — parents love hearing good things.
5. NEVER invent data. If the data doesn't support a claim, don't make it.
6. Tone: comprehensive, calming, focused on the big picture.
7. All text MUST be in Hebrew.
8. insights array: EXACTLY 3-4 items for weekly, 4-5 for monthly.
9. positive_highlights: extract 1-3 positive behaviors if positive_alerts is not empty, otherwise empty array.
10. severity_summary: 'calm' if few/no alerts, 'mixed' if some alerts but also positive, 'intense' if many alerts.

OUTPUT FORMAT (JSON only):
{
  "headline": "כותרת מסכמת של התקופה (עד 12 מילים)",
  "insights": [
    "תובנה על מגמה שזוהתה",
    "תובנה נוספת על דפוס",
    "תובנה על שינוי או קביעות"
  ],
  "suggested_action": "משפט מסכם ומרגיע — לא הנחיה לפעולה",
  "severity_summary": "calm|mixed|intense",
  "positive_highlights": ["התנהגות חיובית שזוהתה"]
}`;

  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DAILY_INSIGHT_AI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!openaiResponse.ok) {
    console.error('OpenAI API error:', openaiResponse.status, await openaiResponse.text());
    return { success: false, reason: 'ai_error' };
  }

  const aiResult = await openaiResponse.json();
  const content = aiResult.choices?.[0]?.message?.content;

  if (!content) {
    return { success: false, reason: 'no_ai_content' };
  }

  const parsed = JSON.parse(content) as PeriodicSummaryResponse;

  if (!Array.isArray(parsed.insights)) {
    parsed.insights = parsed.insights ? [String(parsed.insights)] : ['לא ניתן היה לייצר תובנות'];
  }
  if (!Array.isArray(parsed.positive_highlights)) {
    parsed.positive_highlights = [];
  }

  // Upsert
  const { error: upsertError } = await serviceClient
    .from('child_periodic_summaries')
    .upsert({
      child_id,
      period_type,
      period_start,
      period_end,
      headline: parsed.headline,
      insights: parsed.insights,
      suggested_action: parsed.suggested_action || null,
      severity_summary: parsed.severity_summary || 'calm',
      data_quality: dataQuality,
      positive_highlights: parsed.positive_highlights,
      stats_snapshot: statsSnapshot,
    }, {
      onConflict: 'child_id,period_type,period_start',
    });

  if (upsertError) {
    console.error('Upsert error:', upsertError);
    return { success: false, reason: 'db_error' };
  }

  // Push notification
  if (trigger === 'cron' && childData.parent_id) {
    try {
      const notifTitle = period_type === 'weekly'
        ? `הסיכום השבועי של ${childData.name} מוכן`
        : `הסיכום החודשי של ${childData.name} מוכן`;

      await serviceClient.functions.invoke('send-push-notification', {
        body: {
          parent_id: childData.parent_id,
          title: notifTitle,
          body: parsed.headline,
          url: `/summary/${child_id}/${period_type}`,
          child_name: childData.name,
        },
      });
      console.log(`Push sent for ${period_type} summary of ${childData.name}`);
    } catch (pushErr) {
      console.error('Push notification failed:', pushErr);
    }
  }

  console.log(`${period_type} summary generated for ${childData.name}: ${parsed.headline}`);
  return { success: true, headline: parsed.headline };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { child_id, period_type, trigger } = await req.json();

    if (!child_id || !period_type || !['weekly', 'monthly'].includes(period_type)) {
      return new Response(JSON.stringify({ error: 'Missing or invalid child_id/period_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Monthly cron: check if today is last day of month (tomorrow is day 1)
    if (period_type === 'monthly' && trigger === 'cron') {
      const israelNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
      const tomorrow = new Date(israelNow);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (tomorrow.getDate() !== 1) {
        console.log(`Monthly cron: today is not last day of month (tomorrow is ${tomorrow.getDate()}), skipping`);
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'not_last_day' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle "all" children
    if (child_id === 'all') {
      // Get all children with connected devices
      const { data: allDevices } = await serviceClient
        .from('devices')
        .select('child_id')
        .not('child_id', 'is', null);

      const uniqueChildIds = [...new Set((allDevices || []).map((d: any) => d.child_id))];
      console.log(`Processing ${period_type} summary for ${uniqueChildIds.length} children`);

      const results: any[] = [];
      for (const cid of uniqueChildIds) {
        try {
          const result = await generateSummaryForChild(serviceClient, cid, period_type, trigger);
          results.push({ child_id: cid, ...result });
        } catch (err) {
          console.error(`Error for child ${cid}:`, err);
          results.push({ child_id: cid, success: false, reason: 'exception' });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Single child
    const result = await generateSummaryForChild(serviceClient, child_id, period_type, trigger);

    if (!result.success) {
      const status = result.reason === 'child_not_found' ? 404 : 500;
      return new Response(JSON.stringify(result), {
        status: result.reason === 'insufficient_data' ? 200 : status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('generate-periodic-summary error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
