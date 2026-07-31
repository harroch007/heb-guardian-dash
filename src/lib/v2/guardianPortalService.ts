import { v2Supabase } from "@/integrations/supabase/v2-client";

const requestKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;

export interface V2GuardianPortalSnapshot {
  displayName: string;
  phone: string | null;
  role: "owner" | "guardian";
  guardianCount: number;
  childCount: number;
}

export async function getV2GuardianPortalSnapshot(input: {
  familyId: string;
  userId: string;
}): Promise<V2GuardianPortalSnapshot> {
  const [profileResult, membershipsResult, childrenResult] = await Promise.all([
    v2Supabase
      .from("v2_guardian_profiles")
      .select("display_name, phone")
      .eq("user_id", input.userId)
      .single(),
    v2Supabase
      .from("v2_guardian_memberships")
      .select("guardian_user_id, role, status")
      .eq("family_id", input.familyId)
      .eq("status", "active"),
    v2Supabase
      .from("v2_children")
      .select("id", { count: "exact", head: true })
      .eq("family_id", input.familyId)
      .eq("status", "active"),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (membershipsResult.error) throw membershipsResult.error;
  if (childrenResult.error) throw childrenResult.error;

  const ownMembership = membershipsResult.data?.find(
    (membership) => membership.guardian_user_id === input.userId,
  );
  if (
    !ownMembership ||
    (ownMembership.role !== "owner" && ownMembership.role !== "guardian")
  ) {
    throw new Error("active_guardian_membership_required");
  }

  return {
    displayName: profileResult.data.display_name,
    phone: profileResult.data.phone,
    role: ownMembership.role,
    guardianCount: membershipsResult.data?.length ?? 0,
    childCount: childrenResult.count ?? 0,
  };
}

export async function updateV2GuardianProfile(input: {
  displayName: string;
  phone: string | null;
}): Promise<{ displayName: string; phone: string | null }> {
  const { data, error } = await v2Supabase.rpc(
    "v2_update_guardian_profile",
    {
      target_display_name: input.displayName.trim(),
      target_phone: input.phone?.trim() ?? "",
      target_request_key: requestKey("guardian-profile"),
    },
  );
  if (error) throw error;
  const result = data?.[0];
  if (!result) throw new Error("guardian_profile_update_returned_no_result");
  return {
    displayName: result.display_name,
    phone: result.phone,
  };
}
