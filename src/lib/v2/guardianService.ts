import { supabase } from "@/integrations/supabase/client";
import { v2Supabase } from "@/integrations/supabase/v2-client";

const requestKey = (prefix: string) =>
  `${prefix}:${crypto.randomUUID()}`;

export interface V2GuardianContext {
  familyId: string;
  role: "owner" | "guardian";
  displayName: string | null;
  phone: string | null;
}

export async function getGuardianContext(
  userId: string,
): Promise<V2GuardianContext | null> {
  const { data: membership, error: membershipError } = await v2Supabase
    .from("v2_guardian_memberships")
    .select("family_id, role")
    .eq("guardian_user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return null;
  if (membership.role !== "owner" && membership.role !== "guardian") {
    throw new Error("unsupported_guardian_role");
  }

  const { data: profile, error: profileError } = await v2Supabase
    .from("v2_guardian_profiles")
    .select("display_name, phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;

  return {
    familyId: membership.family_id,
    role: membership.role,
    displayName: profile.display_name,
    phone: profile.phone,
  };
}

export async function bootstrapGuardian(input: {
  displayName: string;
  phone: string | null;
}): Promise<{ familyId: string; created: boolean }> {
  const { data, error } = await v2Supabase.rpc(
    "v2_bootstrap_guardian",
    {
      target_family_id: crypto.randomUUID(),
      target_display_name: input.displayName.trim(),
      target_phone: input.phone?.trim() || "",
      target_request_key: requestKey("guardian-bootstrap"),
    },
  );
  if (error) throw error;
  const result = data?.[0];
  if (!result) throw new Error("guardian_bootstrap_returned_no_context");
  return {
    familyId: result.family_id,
    created: result.created,
  };
}

export async function createGuardianChild(input: {
  familyId: string;
  displayName: string;
  birthYear: number;
  gender: "male" | "female" | "other";
}): Promise<{ childId: string; created: boolean }> {
  const childId = crypto.randomUUID();
  const { data, error } = await v2Supabase.rpc(
    "v2_create_guardian_child",
    {
      target_child_id: childId,
      target_family_id: input.familyId,
      target_display_name: input.displayName.trim(),
      target_birth_year: input.birthYear,
      target_gender: input.gender,
      target_request_key: requestKey("guardian-child"),
    },
  );
  if (error) throw error;
  const result = data?.[0];
  if (!result) throw new Error("guardian_child_returned_no_result");
  return {
    childId: result.child_id,
    created: result.created,
  };
}

export interface V2ChildInstallSession {
  install_session_id: string;
  expires_at: string;
  activation_url: string;
  qr_payload: string;
}

export type V2ChildInstallSessionStatus =
  | "created"
  | "activated"
  | "consumed"
  | "cancelled"
  | "expired";

export interface V2ChildInstallStatus {
  status: V2ChildInstallSessionStatus;
  expires_at: string;
}

const childInstallStatuses = new Set<V2ChildInstallSessionStatus>([
  "created",
  "activated",
  "consumed",
  "cancelled",
  "expired",
]);

export async function createChildInstallSession(
  childId: string,
): Promise<V2ChildInstallSession> {
  const { data, error } = await supabase.functions.invoke(
    "v2-create-child-install",
    { body: { child_id: childId } },
  );
  if (error) throw error;
  if (
    !data ||
    typeof data.install_session_id !== "string" ||
    typeof data.expires_at !== "string" ||
    typeof data.activation_url !== "string" ||
    typeof data.qr_payload !== "string"
  ) {
    throw new Error("invalid_child_install_session");
  }
  return data as V2ChildInstallSession;
}

export async function getChildInstallSessionStatus(
  sessionId: string,
): Promise<V2ChildInstallStatus | null> {
  const { data, error } = await v2Supabase.rpc(
    "v2_get_child_install_session_status",
    { target_session_id: sessionId },
  );
  if (error) throw error;

  const result = data?.[0];
  if (!result) return null;
  if (
    !childInstallStatuses.has(result.status as V2ChildInstallSessionStatus) ||
    typeof result.expires_at !== "string"
  ) {
    throw new Error("invalid_child_install_session_status");
  }

  return result as V2ChildInstallStatus;
}
