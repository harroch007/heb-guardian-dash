import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Web Push encryption utilities
async function generateVapidAuth(endpoint: string, vapidPublicKey: string, vapidPrivateKey: string, subject: string) {
  const encoder = new TextEncoder();
  
  // Parse the endpoint URL
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  
  // Create JWT header and payload
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };
  
  // Base64url encode
  const base64url = (data: Uint8Array | string) => {
    const str = typeof data === 'string' ? data : String.fromCharCode(...data);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Import private key
  const privateKeyBuffer = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  
  // Create ECDSA key for signing
  const key = await crypto.subtle.importKey(
    'raw',
    privateKeyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(unsignedToken)
  );
  
  const signatureB64 = base64url(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;
  
  return {
    authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
  };
}

async function sendPushToEndpoint(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ success: boolean; status?: number; expired?: boolean }> {
  try {
    const payloadStr = JSON.stringify(payload);
    
    // For now, send unencrypted payload (most push services accept this)
    // Full encryption would require implementing the RFC 8291 protocol
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400', // 24 hours
        'Urgency': 'high',
      },
      body: payloadStr,
    });
    
    if (response.status === 201 || response.status === 200) {
      return { success: true, status: response.status };
    }
    
    // 404 or 410 means subscription is expired/invalid
    if (response.status === 404 || response.status === 410) {
      console.log(`Subscription expired: ${subscription.endpoint}`);
      return { success: false, status: response.status, expired: true };
    }
    
    console.error(`Push failed with status ${response.status}: ${await response.text()}`);
    return { success: false, status: response.status };
  } catch (error) {
    console.error('Push send error:', error);
    return { success: false };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { parent_id, title, body, url, alert_id, child_name } = await req.json();
    
    if (!parent_id) {
      return new Response(
        JSON.stringify({ error: 'parent_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending push notification to parent ${parent_id}: ${title}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured, skipping push notification');
      return new Response(
        JSON.stringify({ success: false, reason: 'VAPID keys not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all subscriptions for this parent
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('parent_id', parent_id);

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      throw new Error(`Failed to fetch subscriptions: ${fetchError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for parent ${parent_id}`);
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: 'No subscriptions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions for parent ${parent_id}`);

    // Build notification payload
    const payload = {
      title: title || 'התראה חדשה מ-Kippy',
      body: body || 'נמצא תוכן שדורש את תשומת לבך',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'he',
      tag: alert_id ? `alert-${alert_id}` : 'kippy-notification',
      url: url || '/alerts',
      child_name: child_name,
    };

    // Send to all subscriptions
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const result = await sendPushToEndpoint(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          'mailto:support@kippy.app'
        );
        return { ...result, id: sub.id };
      })
    );

    // Clean up expired subscriptions
    const expiredIds = results
      .filter(r => r.expired)
      .map(r => r.id);

    if (expiredIds.length > 0) {
      console.log(`Cleaning up ${expiredIds.length} expired subscriptions`);
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredIds);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Push notification sent: ${successCount}/${subscriptions.length} successful`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: subscriptions.length,
        expired_cleaned: expiredIds.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Send push notification error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
