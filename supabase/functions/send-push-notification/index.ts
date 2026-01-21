import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { parent_id, title, body, url, alert_id, child_name } = await req.json();

    if (!parent_id) {
      return new Response(
        JSON.stringify({ error: "parent_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending push notification to parent ${parent_id}: ${title}`);

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidKeysJson = Deno.env.get("VAPID_KEYS_JWK");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    if (!vapidKeysJson) {
      console.warn("VAPID_KEYS_JWK not configured, skipping push notification");
      return new Response(
        JSON.stringify({ success: false, reason: "VAPID keys not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and import VAPID keys (JWK format from generate-vapid-keys script)
    let vapidKeys: Awaited<ReturnType<typeof webpush.importVapidKeys>>;
    let vapidPublicKeyBase64: string;
    try {
      const exportedKeys = JSON.parse(vapidKeysJson);
      vapidKeys = await webpush.importVapidKeys(exportedKeys, { extractable: true });
      
      // Export the public key in the correct format for the frontend
      const publicKeyRaw = await crypto.subtle.exportKey("raw", vapidKeys.publicKey);
      const publicKeyBytes = new Uint8Array(publicKeyRaw);
      // Convert to base64url
      const base64 = btoa(String.fromCharCode(...publicKeyBytes));
      vapidPublicKeyBase64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      console.log("VAPID keys imported successfully");
      console.log("VAPID public key for frontend:", vapidPublicKeyBase64);
    } catch (error) {
      console.error("Failed to import VAPID keys:", error);
      throw new Error("Invalid VAPID keys format");
    }

    // Create application server with VAPID authentication
    const appServer = await webpush.ApplicationServer.new({
      contactInformation: "mailto:support@kippyai.com",
      vapidKeys,
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch subscriptions for parent
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("parent_id", parent_id);

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      throw new Error(`Failed to fetch subscriptions: ${fetchError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for parent ${parent_id}`);
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions for parent ${parent_id}`);

    // Build notification payload (JSON string for the service worker)
    const payload = JSON.stringify({
      title: title || "התראה חדשה מ-Kippy",
      body: body || "נמצא תוכן שדורש את תשומת לבך",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      dir: "rtl",
      lang: "he",
      tag: alert_id ? `alert-${alert_id}` : "kippy-notification",
      url: url || "/alerts",
      child_name: child_name,
    });

    // Send to all subscriptions with full RFC 8291 encryption
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          // Create subscriber from stored subscription data
          const subscriber = appServer.subscribe({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          });

          // Send encrypted push message (handles RFC 8291 + RFC 8292 automatically)
          // pushTextMessage returns void and throws on error
          await subscriber.pushTextMessage(payload, {
            ttl: 86400,
          });

          console.log(`Push sent successfully to ${sub.endpoint.substring(0, 50)}...`);
          return { success: true, id: sub.id };
        } catch (error) {
          // Log full error details for debugging
          console.error(`Push error for subscription ${sub.id}:`, {
            error,
            message: error instanceof Error ? error.message : String(error),
            name: error instanceof Error ? error.name : 'Unknown',
            stack: error instanceof Error ? error.stack : undefined,
          });
          
          const errorString = String(error);
          
          // Check for expired subscription errors
          if (errorString.includes("410") || errorString.includes("404") || errorString.includes("Gone")) {
            console.log(`Subscription expired: ${sub.endpoint}`);
            return { success: false, id: sub.id, expired: true };
          }
          
          return { success: false, id: sub.id };
        }
      })
    );

    // Clean up expired subscriptions
    const expiredIds = results.filter((r) => r.expired).map((r) => r.id);
    if (expiredIds.length > 0) {
      console.log(`Cleaning up ${expiredIds.length} expired subscriptions`);
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`Push notification sent: ${successCount}/${subscriptions.length} successful`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: subscriptions.length,
        expired_cleaned: expiredIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Send push notification error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
