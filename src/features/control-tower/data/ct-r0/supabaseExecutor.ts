import { supabase } from "@/integrations/supabase/client";
import type { CtR0RpcExecutor } from "./contracts";

interface RpcBuilder extends PromiseLike<{ readonly data: unknown; readonly error: unknown | null }> {
  abortSignal(signal: AbortSignal): RpcBuilder;
}

type UntypedRpc = (
  name: string,
  arguments_: Readonly<Record<string, string | number | boolean | null>>,
) => RpcBuilder;

/** Uses the authenticated browser session and only the frozen CT-R0 RPC allowlist. */
export const executeCtR0SupabaseRpc: CtR0RpcExecutor = async (
  rpcName,
  arguments_,
  signal,
) => {
  const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
  const request = rpc(rpcName, arguments_);
  const result = await (signal ? request.abortSignal(signal) : request);
  return { data: result.data, error: result.error };
};
