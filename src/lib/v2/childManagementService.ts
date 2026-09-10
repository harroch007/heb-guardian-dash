import { v2Supabase } from "@/integrations/supabase/v2-client";

/** Archive the child and revoke device access in one authenticated transaction. */
export async function archiveGuardianChild(
  childId: string,
  requestKey: string,
): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const { data, error } = await v2Supabase.rpc("v2_archive_guardian_child", {
      target_child_id: childId,
      target_request_key: requestKey,
    }).abortSignal(controller.signal);
    if (error) throw error;
    if (data?.length !== 1 || data[0].child_id !== childId || data[0].archived !== true) {
      throw new Error("invalid_child_archive_result");
    }
  } finally {
    window.clearTimeout(timeout);
  }
}
