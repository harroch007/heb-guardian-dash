import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = 'https://fsedenvbdpctzoznppwo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Thresholds in minutes
const INACTIVE_THRESHOLD = 15;
const DISCONNECTED_THRESHOLD = 60;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[check-device-health] Starting device health check...');

    // Create Supabase client with service role for full access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Calculate threshold timestamps
    const now = new Date();
    const disconnectedThreshold = new Date(now.getTime() - DISCONNECTED_THRESHOLD * 60 * 1000).toISOString();
    
    // Find devices that haven't reported in over an hour
    const { data: staleDevices, error: fetchError } = await supabase
      .from('devices')
      .select(`
        device_id,
        child_id,
        last_seen,
        children (
          name,
          parent_id
        )
      `)
      .not('child_id', 'is', null)
      .lt('last_seen', disconnectedThreshold);

    if (fetchError) {
      console.error('[check-device-health] Error fetching stale devices:', fetchError);
      throw fetchError;
    }

    console.log(`[check-device-health] Found ${staleDevices?.length || 0} stale devices`);

    if (!staleDevices || staleDevices.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No stale devices found',
          checked_at: now.toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each stale device
    let alertsCreated = 0;
    let eventsCreated = 0;

    for (const device of staleDevices) {
      // Handle the children relation - it's an array from the join
      const childrenArray = device.children as unknown as Array<{ name: string; parent_id: string }> | null;
      const childData = childrenArray && childrenArray.length > 0 ? childrenArray[0] : null;
      
      if (!childData || !device.child_id) {
        console.log(`[check-device-health] Skipping device ${device.device_id} - no child linked`);
        continue;
      }

      // Check if we already created an event for this device recently (last 2 hours)
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const { data: existingEvent } = await supabase
        .from('device_events')
        .select('id')
        .eq('device_id', device.device_id)
        .eq('event_type', 'heartbeat_lost')
        .gt('created_at', twoHoursAgo)
        .limit(1);

      if (existingEvent && existingEvent.length > 0) {
        console.log(`[check-device-health] Device ${device.device_id} already has recent heartbeat_lost event, skipping`);
        continue;
      }

      // Calculate how long since last seen
      const lastSeenDate = new Date(device.last_seen);
      const minutesSinceLastSeen = Math.floor((now.getTime() - lastSeenDate.getTime()) / 60000);
      const hoursSinceLastSeen = Math.floor(minutesSinceLastSeen / 60);

      console.log(`[check-device-health] Device ${device.device_id} for child ${childData.name} - last seen ${minutesSinceLastSeen} minutes ago`);

      // Create device event
      const { error: eventError } = await supabase
        .from('device_events')
        .insert({
          device_id: device.device_id,
          child_id: device.child_id,
          event_type: 'heartbeat_lost',
          event_data: {
            last_seen: device.last_seen,
            minutes_since_last_seen: minutesSinceLastSeen,
            detected_at: now.toISOString(),
          },
          is_notified: false,
        });

      if (eventError) {
        console.error(`[check-device-health] Error creating event for device ${device.device_id}:`, eventError);
      } else {
        eventsCreated++;
      }

      // Create alert for parent
      const timeDescription = hoursSinceLastSeen > 0 
        ? `${hoursSinceLastSeen} שעות` 
        : `${minutesSinceLastSeen} דקות`;

      const { error: alertError } = await supabase
        .from('alerts')
        .insert({
          child_id: device.child_id,
          device_id: device.device_id,
          category: 'system',
          sender: 'system',
          sender_display: 'התראת מערכת',
          parent_message: `⚠️ הטלפון של ${childData.name} לא מדווח כבר ${timeDescription}. יתכן שהאפליקציה הוסרה, הטלפון כבוי, או שאין חיבור לאינטרנט.`,
          is_processed: true,
          should_alert: true,
          ai_risk_score: 50,
        });

      if (alertError) {
        console.error(`[check-device-health] Error creating alert for device ${device.device_id}:`, alertError);
      } else {
        alertsCreated++;
        console.log(`[check-device-health] Created alert for ${childData.name}`);
      }
    }

    console.log(`[check-device-health] Completed. Events: ${eventsCreated}, Alerts: ${alertsCreated}`);

    return new Response(
      JSON.stringify({
        success: true,
        stale_devices: staleDevices.length,
        events_created: eventsCreated,
        alerts_created: alertsCreated,
        checked_at: now.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[check-device-health] Error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});