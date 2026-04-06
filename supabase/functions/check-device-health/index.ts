import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://fsedenvbdpctzoznppwo.supabase.co';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Thresholds in minutes
const INACTIVE_THRESHOLD = 15;
const DISCONNECTED_THRESHOLD = 60;

/**
 * Send push notification to all resolved recipients for a child.
 */
async function sendPushToRecipients(
  supabase: ReturnType<typeof createClient>,
  childId: string,
  childName: string,
  title: string,
  body: string,
  url: string,
) {
  const { data: recipients } = await supabase.rpc('get_alert_recipients', {
    p_child_id: childId,
  });

  if (!recipients || recipients.length === 0) {
    console.log(`[check-device-health] No push recipients found for child ${childId}`);
    return;
  }

  for (const recipient of recipients) {
    const parentId = typeof recipient === 'string' ? recipient : recipient.parent_id;
    console.log(`[check-device-health] Sending push to parent ${parentId} for child ${childName}`);

    try {
      const pushResp = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          parent_id: parentId,
          title,
          body,
          url,
          child_name: childName,
        }),
      });

      const pushResult = await pushResp.json();
      console.log(`[check-device-health] Push result for parent ${parentId}:`, pushResult);
    } catch (err) {
      console.error(`[check-device-health] Push error for parent ${parentId}:`, err);
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[check-device-health] Starting device health check...');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const now = new Date();
    const disconnectedThreshold = new Date(now.getTime() - DISCONNECTED_THRESHOLD * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

    // =============================================
    // PHASE 1: Recovery detection
    // Find devices that had a heartbeat_lost event recently
    // but are now back online (last_seen >= threshold).
    // Only fire if no heartbeat_recovered event exists
    // after the most recent heartbeat_lost for that device.
    // =============================================
    let recoveryPushesSent = 0;

    const { data: recentLostEvents, error: lostError } = await supabase
      .from('device_events')
      .select(`
        id,
        device_id,
        child_id,
        created_at
      `)
      .eq('event_type', 'heartbeat_lost')
      .gt('created_at', twoHoursAgo)
      .order('created_at', { ascending: false });

    if (lostError) {
      console.error('[check-device-health] Error fetching lost events:', lostError);
    }

    if (recentLostEvents && recentLostEvents.length > 0) {
      // Deduplicate to latest heartbeat_lost per device
      const latestLostByDevice = new Map<string, { id: string; child_id: string; created_at: string }>();
      for (const evt of recentLostEvents) {
        if (!latestLostByDevice.has(evt.device_id)) {
          latestLostByDevice.set(evt.device_id, {
            id: evt.id,
            child_id: evt.child_id,
            created_at: evt.created_at,
          });
        }
      }

      for (const [deviceId, lostEvt] of latestLostByDevice) {
        if (!lostEvt.child_id) continue;

        // Check if device is back online (last_seen >= disconnected threshold)
        const { data: deviceRow } = await supabase
          .from('devices')
          .select('device_id, child_id, last_seen, children ( name, parent_id )')
          .eq('device_id', deviceId)
          .gte('last_seen', disconnectedThreshold)
          .maybeSingle();

        if (!deviceRow) continue; // still offline

        // Check no heartbeat_recovered already exists after the heartbeat_lost
        const { data: existingRecovery } = await supabase
          .from('device_events')
          .select('id')
          .eq('device_id', deviceId)
          .eq('event_type', 'heartbeat_recovered')
          .gt('created_at', lostEvt.created_at)
          .limit(1);

        if (existingRecovery && existingRecovery.length > 0) {
          console.log(`[check-device-health] Device ${deviceId} already has recovery event, skipping`);
          continue;
        }

        const childrenArray = deviceRow.children as unknown as Array<{ name: string; parent_id: string }> | null;
        const childData = childrenArray && childrenArray.length > 0 ? childrenArray[0] : null;

        if (!childData) continue;

        console.log(`[check-device-health] Device ${deviceId} recovered for child ${childData.name}`);

        // Create heartbeat_recovered event (dedup marker)
        const { error: recEvtErr } = await supabase
          .from('device_events')
          .insert({
            device_id: deviceId,
            child_id: lostEvt.child_id,
            event_type: 'heartbeat_recovered',
            event_data: {
              recovered_at: now.toISOString(),
              lost_event_id: lostEvt.id,
            },
            is_notified: true,
          });

        if (recEvtErr) {
          console.error(`[check-device-health] Error creating recovery event for ${deviceId}:`, recEvtErr);
          continue;
        }

        // Send recovery push
        try {
          await sendPushToRecipients(
            supabase,
            lostEvt.child_id,
            childData.name,
            'המכשיר חזר להתחבר',
            `${childData.name} שוב מחובר/ת`,
            '/alerts',
          );
          recoveryPushesSent++;
        } catch (pushErr) {
          console.error(`[check-device-health] Recovery push error for ${childData.name}:`, pushErr);
        }
      }
    }

    console.log(`[check-device-health] Recovery pushes sent: ${recoveryPushesSent}`);

    // =============================================
    // PHASE 2: Stale device detection (existing logic)
    // =============================================
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

    let alertsCreated = 0;
    let eventsCreated = 0;

    if (staleDevices && staleDevices.length > 0) {
      for (const device of staleDevices) {
        const childrenArray = device.children as unknown as Array<{ name: string; parent_id: string }> | null;
        const childData = childrenArray && childrenArray.length > 0 ? childrenArray[0] : null;

        if (!childData || !device.child_id) {
          console.log(`[check-device-health] Skipping device ${device.device_id} - no child linked`);
          continue;
        }

        // Check if we already created an event for this device recently (last 2 hours)
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
            ai_verdict: 'notify',
          });

        if (alertError) {
          console.error(`[check-device-health] Error creating alert for device ${device.device_id}:`, alertError);
        } else {
          alertsCreated++;
          console.log(`[check-device-health] Created alert for ${childData.name}`);

          // Send offline push notification
          try {
            await sendPushToRecipients(
              supabase,
              device.child_id,
              childData.name,
              'המכשיר לא זמין',
              `${childData.name} לא מחובר/ת כבר יותר משעה`,
              '/alerts',
            );
          } catch (pushErr) {
            console.error(`[check-device-health] Push notification error for ${childData.name}:`, pushErr);
          }
        }
      }
    }

    console.log(`[check-device-health] Completed. Events: ${eventsCreated}, Alerts: ${alertsCreated}, Recoveries: ${recoveryPushesSent}`);

    return new Response(
      JSON.stringify({
        success: true,
        stale_devices: staleDevices?.length || 0,
        events_created: eventsCreated,
        alerts_created: alertsCreated,
        recovery_pushes_sent: recoveryPushesSent,
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
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
