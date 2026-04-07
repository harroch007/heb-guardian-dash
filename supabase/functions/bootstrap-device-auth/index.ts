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
    const { device_id, pairing_code } = await req.json();

    if (!device_id || typeof device_id !== "string" || device_id.length < 4) {
      return new Response(
        JSON.stringify({ error: "INVALID_DEVICE_ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!pairing_code || typeof pairing_code !== "string") {
      return new Response(
        JSON.stringify({ error: "INVALID_PAIRING_CODE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Service-role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Step 1: Call existing pair_device RPC (preserves current product logic)
    const { data: pairResult, error: pairError } = await supabaseAdmin.rpc(
      "pair_device",
      { p_device_id: device_id, p_pairing_code: pairing_code }
    );

    if (pairError) {
      console.error("pair_device RPC error:", pairError);
      return new Response(
        JSON.stringify({ error: "PAIRING_FAILED", detail: pairError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const row = Array.isArray(pairResult) ? pairResult[0] : pairResult;
    if (!row?.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error_message: row?.error_message || "INVALID_OR_EXPIRED_CODE",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const childId = row.child_id;
    const childName = row.child_name;

    // Step 2: Check if this device already has an auth identity
    const { data: existingDevice } = await supabaseAdmin
      .from("devices")
      .select("auth_user_id")
      .eq("device_id", device_id)
      .maybeSingle();

    if (existingDevice?.auth_user_id) {
      // Device already has an auth identity — retrieve existing user and reset password
      const newPassword = crypto.randomUUID();

      const { error: updatePwError } = await supabaseAdmin.auth.admin.updateUserById(
        existingDevice.auth_user_id,
        {
          password: newPassword,
          app_metadata: { device_id, child_id: childId, role: "device" },
        }
      );

      if (updatePwError) {
        console.error("Failed to reset device user password:", updatePwError);
        return new Response(
          JSON.stringify({ error: "AUTH_UPDATE_FAILED" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const deviceEmail = `device-${device_id}@devices.kippy.internal`;

      return new Response(
        JSON.stringify({
          success: true,
          child_id: childId,
          child_name: childName,
          device_email: deviceEmail,
          device_password: newPassword,
          auth_user_id: existingDevice.auth_user_id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Create a new Supabase Auth user for this device
    const deviceEmail = `device-${device_id}@devices.kippy.internal`;
    const devicePassword = crypto.randomUUID();

    const { data: authUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: deviceEmail,
        password: devicePassword,
        email_confirm: true, // auto-confirm, no verification needed
        app_metadata: {
          device_id,
          child_id: childId,
          role: "device",
        },
        user_metadata: {
          device_id,
          child_name: childName,
        },
      });

    if (createError) {
      // If user already exists (race condition), try to find and update
      if (createError.message?.includes("already been registered")) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1,
        });

        // Fall back: find by email via admin API
        const { data: userByEmail } = await supabaseAdmin
          .from("auth.users")
          .select("id")
          .eq("email", deviceEmail)
          .maybeSingle();

        // If we can't resolve the conflict, return error
        console.error("Device user already exists but not linked:", createError);
        return new Response(
          JSON.stringify({ error: "AUTH_USER_CONFLICT", detail: createError.message }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.error("Failed to create device auth user:", createError);
      return new Response(
        JSON.stringify({ error: "AUTH_CREATE_FAILED", detail: createError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Store the auth_user_id mapping in devices table
    const { error: updateError } = await supabaseAdmin
      .from("devices")
      .update({ auth_user_id: authUser.user.id })
      .eq("device_id", device_id);

    if (updateError) {
      console.error("Failed to link auth_user_id to device:", updateError);
      // Auth user was created but mapping failed — log but don't fail the whole flow
    }

    return new Response(
      JSON.stringify({
        success: true,
        child_id: childId,
        child_name: childName,
        device_email: deviceEmail,
        device_password: devicePassword,
        auth_user_id: authUser.user.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("bootstrap-device-auth error:", err);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
