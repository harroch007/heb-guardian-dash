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
        "id, owner_id, invited_email, invited_name, pairing_code, pairing_code_expires_at, status, revoked_at"
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

    const invitedNameRaw =
      typeof invite.invited_name === "string" ? invite.invited_name.trim() : "";

    if (!invitedNameRaw) {
      // Refuse to fall back to email local-part — that caused co-parents to show
      // the inviter's name (e.g. "yariv") in the greeting. Owner must regenerate
      // the invite with a proper name.
      return json({ error: "INVITE_MISSING_NAME" }, 400);
    }

    const invitedName = invitedNameRaw;

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

    // 4) Ensure a `parents` row exists for the co-parent so HomeGreeting can find a name.
    // Force-overwrite full_name with the invited name (legacy rows may contain an
    // email or stale value).
    try {
      await admin.from("parents").upsert(
        {
          id: userId,
          full_name: invitedName,
          email: cleanEmail,
        },
        { onConflict: "id" }
      );
      // Belt-and-suspenders: explicit update in case upsert hit a conflict path
      // that didn't refresh full_name.
      await admin
        .from("parents")
        .update({ full_name: invitedName })
        .eq("id", userId);
    } catch (e) {
      console.warn("parents upsert skipped:", e);
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
