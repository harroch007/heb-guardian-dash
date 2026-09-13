import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, code } = await req.json().catch(() => ({}));
    const cleanEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanCode = typeof code === "string" ? code.trim() : "";

    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return json({ error: "INVALID_EMAIL" }, 400);
    }
    if (!/^\d{6}$/.test(cleanCode)) {
      return json({ error: "INVALID_CODE_FORMAT" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: lookup, error: lookupErr } = await admin.rpc(
      "v2_lookup_guardian_invite_service",
      { supplied_email: cleanEmail, supplied_code: cleanCode },
    );
    if (lookupErr) {
      console.error("invite lookup error:", lookupErr);
      return json({ error: "LOOKUP_FAILED" }, 500);
    }

    const invite = Array.isArray(lookup) ? lookup[0] : lookup;
    if (!invite?.invite_id) {
      return json({ error: "INVALID_CODE_OR_EMAIL" }, 404);
    }

    const invitedName = String(invite.invited_name ?? "").trim();
    if (!invitedName) {
      return json({ error: "INVITE_MISSING_NAME" }, 400);
    }

    // best-effort waitlist allowance
    try {
      await admin
        .from("allowed_emails")
        .upsert(
          { email: cleanEmail, source: "co_parent_invite" },
          { onConflict: "email" },
        );
    } catch (e) {
      console.warn("allowed_emails upsert skipped:", e);
    }

    let userId: string | null = null;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) {
        console.error("listUsers error:", error);
        break;
      }
      const found = data.users.find(
        (u) => (u.email ?? "").toLowerCase() === cleanEmail,
      );
      if (found) {
        userId = found.id;
        break;
      }
      if (data.users.length < 200) break;
    }

    const oneTimePassword =
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "").slice(0, 8);

    if (!userId) {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: cleanEmail,
          password: oneTimePassword,
          email_confirm: true,
          user_metadata: { full_name: invitedName },
          app_metadata: { invited_as: "co_parent" },
        });
      if (createErr || !created.user) {
        console.error("createUser error:", createErr);
        return json({ error: "USER_CREATE_FAILED" }, 500);
      }
      userId = created.user.id;
    } else {
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password: oneTimePassword,
        email_confirm: true,
        user_metadata: { full_name: invitedName },
      });
      if (updErr) {
        console.error("updateUserById error:", updErr);
        return json({ error: "PASSWORD_RESET_FAILED" }, 500);
      }
    }

    return json({
      success: true,
      email: cleanEmail,
      one_time_password: oneTimePassword,
    });
  } catch (err) {
    console.error("v2-join-family-by-code error:", err);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
