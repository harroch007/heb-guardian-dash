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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Validate invite
    const { data: invite, error: inviteErr } = await admin
      .from("family_members")
      .select(
        "id, owner_id, invited_email, pairing_code, pairing_code_expires_at, status, revoked_at"
      )
      .ilike("invited_email", cleanEmail)
      .eq("pairing_code", cleanCode)
      .eq("status", "pending")
      .is("revoked_at", null)
      .maybeSingle();

    if (inviteErr) {
      console.error("invite lookup error:", inviteErr);
      return json({ error: "LOOKUP_FAILED" }, 500);
    }
    if (!invite) {
      return json({ error: "INVALID_CODE_OR_EMAIL" }, 404);
    }
    if (
      invite.pairing_code_expires_at &&
      new Date(invite.pairing_code_expires_at) < new Date()
    ) {
      return json({ error: "CODE_EXPIRED" }, 410);
    }

    // 2) Allow this email through waitlist (best-effort)
    try {
      await admin
        .from("allowed_emails")
        .upsert(
          { email: cleanEmail, source: "co_parent_invite" },
          { onConflict: "email" }
        );
    } catch (e) {
      console.warn("allowed_emails upsert skipped:", e);
    }

    // 3) Find or create auth user
    let userId: string | null = null;

    // Look up by email via admin API (paginate up to a few pages)
    {
      let page = 1;
      while (page <= 20) {
        const { data, error } = await admin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (error) {
          console.error("listUsers error:", error);
          break;
        }
        const found = data.users.find(
          (u) => (u.email ?? "").toLowerCase() === cleanEmail
        );
        if (found) {
          userId = found.id;
          break;
        }
        if (data.users.length < 200) break;
        page++;
      }
    }

    // Generate one-time password for this sign-in
    const oneTimePassword =
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "").slice(0, 8);

    if (!userId) {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: cleanEmail,
          password: oneTimePassword,
          email_confirm: true,
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
    console.error("join-family-by-code error:", err);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
