// Creates a one-time chat invitation token for the calling user.
// Caller must be authenticated (parent OR paired child device with synthetic auth user).
// Returns a short-lived invite URL the caller can share via WhatsApp/etc.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function randomToken(): string {
  // 16 bytes = 32 hex chars, plenty unique and URL-safe
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const callerAuthId = claimsData.claims.sub as string;

    // Resolve participant id (child or parent) and display name + kippy_tag
    // Try child via devices first
    let inviterId: string | null = null;
    let inviterName: string | null = null;
    let inviterTag: string | null = null;

    const { data: device } = await supabase
      .from("devices")
      .select("child_id")
      .eq("auth_user_id", callerAuthId)
      .maybeSingle();

    if (device?.child_id) {
      inviterId = device.child_id;
      const { data: child } = await supabase
        .from("children")
        .select("name, kippy_tag")
        .eq("id", device.child_id)
        .maybeSingle();
      inviterName = child?.name ?? null;
      inviterTag = child?.kippy_tag ?? null;
    } else {
      // Treat as parent: parents.id == auth.uid
      const { data: parent } = await supabase
        .from("parents")
        .select("id, full_name, kippy_tag")
        .eq("id", callerAuthId)
        .maybeSingle();
      if (parent) {
        inviterId = parent.id;
        inviterName = parent.full_name;
        inviterTag = parent.kippy_tag;
      }
    }

    if (!inviterId) {
      return new Response(
        JSON.stringify({ error: "INVITER_NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = randomToken();
    const { error: insErr } = await supabase
      .from("chat_invites")
      .insert({
        token,
        inviter_id: inviterId,
        inviter_kippy_tag: inviterTag,
        inviter_display_name: inviterName,
      });

    if (insErr) {
      console.error("invite insert failed:", insErr);
      return new Response(
        JSON.stringify({ error: "INVITE_CREATE_FAILED", detail: insErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inviteUrl = `https://kippyai.com/invite/${token}`;
    const shareText =
      `היי! אני ${inviterName ?? "חבר"} בקיפי 👋\n` +
      `רוצה לדבר איתי בצ'אט המאובטח של קיפי? לחץ על הקישור:\n${inviteUrl}`;

    return new Response(
      JSON.stringify({
        success: true,
        token,
        invite_url: inviteUrl,
        share_text: shareText,
        inviter_kippy_tag: inviterTag,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-chat-invite error:", err);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
