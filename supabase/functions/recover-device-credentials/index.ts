// Recovers (or first-time provisions) Supabase Auth credentials for an
// already-paired Android device. Idempotent: if the device has no auth_user_id
// it creates one; if it already has one, the password is rotated.
//
// Verification: caller must supply device_id AND the child_id currently stored
// in `devices`. Both must match the row, otherwise we refuse. This prevents
// random callers from minting credentials for arbitrary devices.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { device_id, child_id } = await req.json();

    if (!device_id || typeof device_id !== "string" || device_id.length < 4) {
      return new Response(
        JSON.stringify({ error: "INVALID_DEVICE_ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!child_id || typeof child_id !== "string") {
      return new Response(
        JSON.stringify({ error: "INVALID_CHILD_ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify device exists and child_id matches what's on file
    const { data: device, error: deviceErr } = await supabase
      .from("devices")
      .select("device_id, child_id, auth_user_id")
      .eq("device_id", device_id)
      .maybeSingle();

    if (deviceErr || !device) {
      return new Response(
        JSON.stringify({ error: "DEVICE_NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (device.child_id !== child_id) {
      return new Response(
        JSON.stringify({ error: "DEVICE_CHILD_MISMATCH" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up child for metadata
    const { data: child } = await supabase
      .from("children")
      .select("name")
      .eq("id", child_id)
      .maybeSingle();

    const deviceEmail = `device-${device_id}@devices.kippy.internal`;
    const newPassword = crypto.randomUUID();

    let authUserId = device.auth_user_id as string | null;

    if (!authUserId) {
      // First-time provisioning for an already-paired legacy device
      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email: deviceEmail,
          password: newPassword,
          email_confirm: true,
          app_metadata: { device_id, child_id, role: "device" },
          user_metadata: { device_id, child_name: child?.name ?? null },
        });

      if (createErr) {
        // If the email is already taken (orphaned auth user), recover it
        if (createErr.message?.includes("already been registered") ||
            createErr.message?.includes("already exists")) {
          // Find existing user by listing — paginate up to a few pages
          let foundId: string | null = null;
          for (let page = 1; page <= 20 && !foundId; page++) {
            const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
            const match = list?.users?.find((u) => u.email === deviceEmail);
            if (match) foundId = match.id;
            if (!list || list.users.length < 200) break;
          }
          if (!foundId) {
            return new Response(
              JSON.stringify({ error: "AUTH_USER_LOOKUP_FAILED" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          authUserId = foundId;
        } else {
          return new Response(
            JSON.stringify({ error: "AUTH_CREATE_FAILED", detail: createErr.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        authUserId = created.user.id;
      }

      // Link to device row
      const { error: linkErr } = await supabase
        .from("devices")
        .update({ auth_user_id: authUserId })
        .eq("device_id", device_id);
      if (linkErr) console.error("link auth_user_id failed:", linkErr);
    }

    // Always rotate password and ensure metadata is current
    const { error: updateErr } = await supabase.auth.admin.updateUserById(
      authUserId!,
      {
        password: newPassword,
        app_metadata: { device_id, child_id, role: "device" },
      }
    );

    if (updateErr) {
      console.error("password rotation failed:", updateErr);
      return new Response(
        JSON.stringify({ error: "PASSWORD_UPDATE_FAILED", detail: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        child_id,
        device_email: deviceEmail,
        device_password: newPassword,
        auth_user_id: authUserId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("recover-device-credentials error:", err);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
