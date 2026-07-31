import type { Json } from "@/integrations/supabase/v2-types";

export const PARENTAL_CONTROL_COMMANDS = [
  "REPORT_HEARTBEAT",
  "LOCATE_NOW",
  "RING_DEVICE",
  "REFRESH_SETTINGS",
] as const;

export type ParentalControlCommandType =
  (typeof PARENTAL_CONTROL_COMMANDS)[number];

export type ParentalControlCommandStatus =
  | "PENDING"
  | "ACKNOWLEDGED"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "TIMED_OUT";

export interface ParentalControlCommand {
  id: string;
  device_id: string;
  command_type: string;
  status: string;
  result: string | null;
  payload: Json;
  requested_by: string | null;
  request_key: string | null;
  expires_at: string | null;
  acknowledged_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_COMMAND_TTL_SECONDS = 120;

const TERMINAL_COMMAND_STATUSES = new Set<string>([
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "TIMED_OUT",
]);

export function isTerminalCommandStatus(status: string): boolean {
  return TERMINAL_COMMAND_STATUSES.has(status);
}

export function createParentalControlRequestKey(
  commandType: ParentalControlCommandType,
): string {
  const randomPart =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${commandType}:${randomPart}`;
}
