// Accepts a chat invitation token and creates an accepted friendship between
// the inviter and the calling user. Idempotent: if a friendship already exists,
// returns it. Validates: token exists, not expired, not already accepted by
// someone else, acceptor != inviter.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function resolveCallerParticipant(
  supabase: ReturnType<typeof createClient>,
  authUserId: string,
): Promise<{ id: string; name: string | null; tag: string | null } | null> {
  const { data: device } = await supabase
    .from("devices")
    .select("child_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (device?.child_id) {
    const { data: child } = await supabase
      .from("children")
      .select("name, kippy_tag, parent_id")
      .eq("id", device.child_id)
      .maybeSingle();
    return {
      id: device.child_id as string,
      name: child?.name ?? null,
      tag: child?.kippy_tag ?? null,
    };
  }

  const { data: parent } = await supabase
    .from("parents")
    .select("id, full_name, kippy_tag")
    .eq("id", authUserId)
    .maybeSingle();
  if (parent) {
    return { id: parent.id as string, name: parent.full_name, tag: parent.kippy_tag };
  }
  return null;
}

async function lookupParticipantInfo(
  supabase: ReturnType<typeof createClient>,
  participantId: string,
): Promise<{ name: string | null; tag: string | null; type: "child" | "parent" }> {
  const { data: child } = await supabase
    .from("children")
    .select("name, kippy_tag, parent_id")
    .eq("id", participantId)
    .maybeSingle();
  if (child) return { name: child.name, tag: child.kippy_tag, type: "child" };

  const { data: parent } = await supabase
    .from("parents")
    .select("full_name, kippy_tag")
    .eq("id", participantId)
    .maybeSingle();
  return {
    name: parent?.full_name ?? null,
    tag: parent?.kippy_tag ?? null,
    type: "parent",
  };
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

    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ error: "INVALID_TOKEN" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Load invite
    const { data: invite, error: invErr } = await supabase
      .from("chat_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (invErr || !invite) {
      return new Response(
        JSON.stringify({ error: "INVITE_NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({ error: "INVITE_EXPIRED" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const acceptor = await resolveCallerParticipant(supabase, callerAuthId);
    if (!acceptor) {
      return new Response(
        JSON.stringify({ error: "ACCEPTOR_NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (acceptor.id === invite.inviter_id) {
      return new Response(
        JSON.stringify({ error: "CANNOT_ACCEPT_OWN_INVITE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If invite already accepted: only allow the original acceptor to retrieve it.
    if (invite.accepted_at && invite.accepted_by_id !== acceptor.id) {
      return new Response(
        JSON.stringify({ error: "INVITE_ALREADY_USED" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up inviter info for the response
    const inviterInfo = await lookupParticipantInfo(supabase, invite.inviter_id);

    // Find or create friendship between inviter and acceptor
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status")
      .or(
        `and(requester_id.eq.${invite.inviter_id},receiver_id.eq.${acceptor.id}),` +
        `and(requester_id.eq.${acceptor.id},receiver_id.eq.${invite.inviter_id})`
      )
      .maybeSingle();

    let friendshipId: string;
    if (existing) {
      friendshipId = existing.id as string;
      if (existing.status !== "accepted") {
        await supabase
          .from("friendships")
          .update({ status: "accepted", responded_at: new Date().toISOString() })
          .eq("id", friendshipId);
      }
    } else {
      const { data: newFriend, error: fErr } = await supabase
        .from("friendships")
        .insert({
          requester_id: invite.inviter_id,
          receiver_id: acceptor.id,
          status: "accepted",
          responded_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (fErr) {
        console.error("friendship create failed:", fErr);
        return new Response(
          JSON.stringify({ error: "FRIENDSHIP_CREATE_FAILED", detail: fErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      friendshipId = newFriend.id as string;
    }

    // Ensure both sides exist as chat_participants (best effort, ignore failures)
    const upsertParticipant = async (pid: string, name: string | null, type: string) => {
      const { data: cur } = await supabase
        .from("chat_participants")
        .select("participant_id")
        .eq("participant_id", pid)
        .maybeSingle();
      if (!cur) {
        await supabase.from("chat_participants").insert({
          participant_id: pid,
          participant_type: type,
          display_name: name,
        });
      }
    };
    await upsertParticipant(invite.inviter_id, inviterInfo.name, inviterInfo.type);
    await upsertParticipant(acceptor.id, acceptor.name, "child"); // best-effort guess

    // Mark invite accepted
    await supabase
      .from("chat_invites")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by_id: acceptor.id,
        friendship_id: friendshipId,
      })
      .eq("token", token);

    return new Response(
      JSON.stringify({
        success: true,
        friendship_id: friendshipId,
        peer_id: invite.inviter_id,
        peer_name: inviterInfo.name,
        peer_kippy_tag: inviterInfo.tag,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("accept-chat-invite error:", err);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
