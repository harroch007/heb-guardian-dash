import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./client";
import type { Database as V2Database } from "./v2-types";

/**
 * Typed V2 view of the single runtime Supabase client.
 *
 * Keeping one client preserves one auth/session owner while allowing the V1
 * donor source to compile until the non-destructive cleanup phase.
 */
export const v2Supabase =
  supabase as unknown as SupabaseClient<V2Database>;
