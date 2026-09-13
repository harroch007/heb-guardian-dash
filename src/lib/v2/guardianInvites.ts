import { supabase } from "@/integrations/supabase/client";

export interface V2GuardianInvite {
  id: string;
  invited_email: string;
  invited_name: string;
  code_expires_at: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  created_at: string;
}

export interface V2CreatedInvite {
  inviteId: string;
  code: string;
  email: string;
  name: string;
  expiresAt: string;
}

const rpc = (fn: string, args: Record<string, unknown>) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPCs added after the generated types snapshot.
  (supabase as any).rpc(fn, args);

export async function listGuardianInvites(
  familyId: string,
): Promise<V2GuardianInvite[]> {
  const { data, error } = await (supabase as never as typeof supabase)
    .from("v2_guardian_invites" as never)
    .select("id, invited_email, invited_name, code_expires_at, status, created_at")
    .eq("family_id" as never, familyId as never)
    .order("created_at" as never, { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as V2GuardianInvite[];
}

export async function createGuardianInvite(input: {
  email: string;
  name: string;
  receiveAlerts?: boolean;
}): Promise<V2CreatedInvite> {
  const { data, error } = await rpc("v2_create_guardian_invite", {
    target_email: input.email.trim(),
    target_name: input.name.trim(),
    target_receive_alerts: input.receiveAlerts ?? false,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("invite_not_created");
  return {
    inviteId: row.invite_id,
    code: row.invite_code,
    email: row.invited_email,
    name: row.invited_name,
    expiresAt: row.code_expires_at,
  };
}

export async function regenerateGuardianInviteCode(
  inviteId: string,
): Promise<{ code: string; expiresAt: string }> {
  const { data, error } = await rpc("v2_regenerate_guardian_invite_code", {
    target_invite_id: inviteId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("invite_not_found");
  return { code: row.invite_code, expiresAt: row.code_expires_at };
}

export async function cancelGuardianInvite(inviteId: string): Promise<void> {
  const { error } = await rpc("v2_cancel_guardian_invite", {
    target_invite_id: inviteId,
  });
  if (error) throw error;
}

export async function claimGuardianInvite(code: string): Promise<void> {
  const { error } = await rpc("v2_claim_guardian_invite", {
    supplied_code: code.trim(),
  });
  if (error) throw error;
}
