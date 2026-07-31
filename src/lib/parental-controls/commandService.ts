import { v2Supabase } from "@/integrations/supabase/v2-client";
import type {
  Database as V2Database,
  Json,
} from "@/integrations/supabase/v2-types";
import {
  createParentalControlRequestKey,
  DEFAULT_COMMAND_TTL_SECONDS,
  type ParentalControlCommand,
  type ParentalControlCommandType,
} from "./contracts";

interface EnqueueCommandInput {
  deviceId: string;
  commandType: ParentalControlCommandType;
  payload?: Json;
  requestKey?: string;
  ttlSeconds?: number;
}

interface ListRecentCommandsInput {
  deviceIds: string[];
  commandType?: ParentalControlCommandType;
  statuses?: string[];
  since?: string;
  limit?: number;
}

type V2CommandRow =
  V2Database["public"]["Tables"]["v2_device_commands"]["Row"];

const normalizeCommand = (row: V2CommandRow): ParentalControlCommand => ({
  id: row.id,
  device_id: row.device_id,
  command_type: row.command_type,
  status: row.status.toUpperCase(),
  result: null,
  payload: row.payload,
  requested_by: row.requested_by,
  request_key: row.idempotency_key,
  expires_at: row.expires_at,
  acknowledged_at: row.claimed_at,
  completed_at: row.completed_at,
  error_code: row.failure_code,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

/**
 * V2 command boundary for the parent app.
 *
 * This boundary uses only the canonical V2 RPC and table. There is no fallback
 * to the legacy command queue.
 */
export async function enqueueParentalControlCommand({
  deviceId,
  commandType,
  payload = {},
  requestKey = createParentalControlRequestKey(commandType),
  ttlSeconds = DEFAULT_COMMAND_TTL_SECONDS,
}: EnqueueCommandInput): Promise<ParentalControlCommand> {
  const { data, error } = await v2Supabase.rpc(
    "v2_request_parental_command",
    {
      target_command_type: commandType,
      target_device_id: deviceId,
      target_payload: payload,
      target_request_key: requestKey,
      requested_ttl_seconds: ttlSeconds,
    },
  );
  if (error) throw error;
  const command = data?.[0];
  if (!command) throw new Error("v2_command_creation_returned_no_data");

  return {
    id: command.id,
    device_id: deviceId,
    command_type: command.command_type,
    status: command.status.toUpperCase(),
    result: null,
    payload,
    requested_by: null,
    request_key: requestKey,
    expires_at: command.expires_at,
    acknowledged_at: null,
    completed_at: null,
    error_code: null,
    created_at: command.created_at,
    updated_at: command.created_at,
  };
}

export async function getParentalControlCommand(
  commandId: string,
): Promise<ParentalControlCommand | null> {
  const { data, error } = await v2Supabase
    .from("v2_device_commands")
    .select("*")
    .eq("id", commandId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeCommand(data) : null;
}

export async function listRecentParentalControlCommands({
  deviceIds,
  commandType,
  statuses,
  since,
  limit = 10,
}: ListRecentCommandsInput): Promise<ParentalControlCommand[]> {
  if (deviceIds.length === 0) return [];

  let query = v2Supabase
    .from("v2_device_commands")
    .select("*")
    .in("device_id", deviceIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (commandType) query = query.eq("command_type", commandType);
  if (statuses?.length) {
    query = query.in(
      "status",
      statuses.map((status) => status.toLowerCase()),
    );
  }
  if (since) query = query.gte("created_at", since);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeCommand);
}

export async function enqueueSettingsRefreshForChild(
  childId: string,
): Promise<ParentalControlCommand[]> {
  const { data: devices, error } = await v2Supabase
    .from("v2_protected_devices")
    .select("id")
    .eq("child_id", childId)
    .in("status", ["active", "degraded"]);

  if (error) throw error;
  if (!devices?.length) return [];

  const batchKey = createParentalControlRequestKey("REFRESH_SETTINGS");
  return Promise.all(
    devices.map((device) =>
      enqueueParentalControlCommand({
        deviceId: device.id,
        commandType: "REFRESH_SETTINGS",
        requestKey: `${batchKey}:${device.id}`,
      }),
    ),
  );
}
