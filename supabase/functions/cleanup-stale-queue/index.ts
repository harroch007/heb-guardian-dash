import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Mark stale queue entries as succeeded where the alert is already processed
    const { data, error } = await supabase
      .from("alert_events_queue")
      .select("id, alert_id")
      .in("status", ["pending", "failed"]);

    if (error) throw error;

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ cleaned: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check which alerts are already processed
    const alertIds = [...new Set(data.map((q) => q.alert_id))];
    const { data: processedAlerts } = await supabase
      .from("alerts")
      .select("id")
      .in("id", alertIds)
      .eq("is_processed", true);

    const processedIds = new Set(processedAlerts?.map((a) => a.id) || []);
    const staleQueueIds = data
      .filter((q) => processedIds.has(q.alert_id))
      .map((q) => q.id);

    if (staleQueueIds.length === 0) {
      return new Response(JSON.stringify({ cleaned: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update stale entries to succeeded
    const { error: updateError } = await supabase
      .from("alert_events_queue")
      .update({ status: "succeeded", updated_at: new Date().toISOString() })
      .in("id", staleQueueIds);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ cleaned: staleQueueIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
