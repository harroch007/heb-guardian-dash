import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the list of `parent_id`s whose children the current authenticated user
 * is allowed to view in the V2 parent app:
 *   - the user themselves (as owner)
 *   - any owner_id from family_members where they are an accepted member
 *
 * This is used to scope `children` queries explicitly so that admin-level RLS
 * bypass policies do NOT leak children from other families into the parent UI.
 */
export async function getFamilyParentIds(userId: string): Promise<string[]> {
  const ids = new Set<string>([userId]);
  const { data } = await supabase
    .from("family_members")
    .select("owner_id")
    .eq("member_id", userId)
    .eq("status", "accepted");
  data?.forEach((row) => {
    if (row.owner_id) ids.add(row.owner_id);
  });
  return Array.from(ids);
}
