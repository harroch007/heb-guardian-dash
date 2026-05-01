import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const YARIV_CHILD_ID = "c30061e9-ed82-48fc-9a5f-2bd94d8bbdd5";
const FRIENDSHIP_ID = "00000000-0000-0000-0000-000000001234";
const DANI_DEVICE_ID = "dani-mock-device-0001";
const DANI_EMAIL = "dani.parent@kippy.mock";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ---- Auth gate: caller must be admin ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } =
      await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return json({ error: "Invalid token" }, 401);
    }
    const { data: isAdminData, error: adminErr } = await userClient.rpc(
      "is_admin",
    );
    if (adminErr || !isAdminData) {
      return json({ error: "Forbidden: admin only" }, 403);
    }

    // ---- Service-role client for everything below ----
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Find or create Dani's auth user
    let daniAuthId: string | null = null;
    const { data: listed, error: listErr } =
      await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw new Error(`listUsers: ${listErr.message}`);
    const existing = listed.users.find(
      (u) => u.email?.toLowerCase() === DANI_EMAIL,
    );
    if (existing) {
      daniAuthId = existing.id;
    } else {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: DANI_EMAIL,
          password: crypto.randomUUID() + "Aa1!",
          email_confirm: true,
          user_metadata: { full_name: "אמא של דני", mock: true },
        });
      if (createErr) throw new Error(`createUser: ${createErr.message}`);
      daniAuthId = created.user!.id;
    }

    // 2. Upsert parents row
    const { error: parentErr } = await admin.from("parents").upsert(
      {
        id: daniAuthId,
        full_name: "אמא של דני",
        email: DANI_EMAIL,
      },
      { onConflict: "id" },
    );
    if (parentErr) throw new Error(`parents upsert: ${parentErr.message}`);

    // 3. Find or create Dani child
    let daniChildId: string | null = null;
    const { data: existingChild } = await admin
      .from("children")
      .select("id")
      .eq("parent_id", daniAuthId)
      .eq("name", "דני")
      .maybeSingle();

    if (existingChild) {
      daniChildId = existingChild.id;
    } else {
      const { data: newChild, error: childErr } = await admin
        .from("children")
        .insert({
          parent_id: daniAuthId,
          name: "דני",
          phone_number: "+972500000001",
          gender: "male",
          date_of_birth: "2012-06-01",
          kippy_tag: "dani#1234",
        })
        .select("id")
        .single();
      if (childErr) throw new Error(`children insert: ${childErr.message}`);
      daniChildId = newChild.id;
    }

    // 4. Upsert device
    const { error: devErr } = await admin.from("devices").upsert(
      {
        device_id: DANI_DEVICE_ID,
        child_id: daniChildId,
        device_model: "MockDevice",
        device_manufacturer: "Kippy",
        last_seen: new Date().toISOString(),
        first_seen_at: new Date().toISOString(),
      },
      { onConflict: "device_id" },
    );
    if (devErr) throw new Error(`devices upsert: ${devErr.message}`);

    // 5. Upsert friendship with fixed UUID
    const { error: friendErr } = await admin.from("friendships").upsert(
      {
        id: FRIENDSHIP_ID,
        requester_id: YARIV_CHILD_ID,
        receiver_id: daniChildId,
        status: "accepted",
        responded_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (friendErr) throw new Error(`friendships upsert: ${friendErr.message}`);

    return json({
      ok: true,
      dani_parent_id: daniAuthId,
      dani_child_id: daniChildId,
      dani_device_id: DANI_DEVICE_ID,
      friendship_id: FRIENDSHIP_ID,
      yariv_child_id: YARIV_CHILD_ID,
    });
  } catch (e) {
    console.error("seed-mock-peer error:", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
