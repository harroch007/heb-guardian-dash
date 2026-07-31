import { v2Supabase } from "@/integrations/supabase/v2-client";

const requestKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;

export interface ScheduleInput {
  schedule_type: string;
  name: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
}

export interface SchedulePatch {
  name?: string;
  days_of_week?: number[];
  start_time?: string;
  end_time?: string;
  is_active?: boolean;
}

interface V2ScheduleWrite {
  childId: string;
  scheduleId: string;
  name: string;
  scheduleType: "daily_recurring" | "weekly_recurring" | "shabbat";
  daysOfWeek: number[] | null;
  startTime: string | null;
  endTime: string | null;
  active: boolean;
  mode: "default" | "manual";
}

const nullableText = (value: string | null) =>
  value as unknown as string;

const nullableDays = (value: number[] | null) =>
  value as unknown as number[];

const canonicalScheduleType = (
  scheduleType: string,
  daysOfWeek: number[] | null,
): V2ScheduleWrite["scheduleType"] => {
  if (scheduleType === "shabbat") return "shabbat";
  return daysOfWeek?.length === 7
    ? "daily_recurring"
    : "weekly_recurring";
};

async function writeV2Schedule(schedule: V2ScheduleWrite): Promise<void> {
  const { error } = await v2Supabase.rpc("v2_upsert_parental_schedule", {
    target_child_id: schedule.childId,
    target_schedule_id: schedule.scheduleId,
    target_name: schedule.name,
    target_schedule_type: schedule.scheduleType,
    target_days_of_week: nullableDays(schedule.daysOfWeek),
    target_start_time: nullableText(schedule.startTime),
    target_end_time: nullableText(schedule.endTime),
    target_is_active: schedule.active,
    target_mode: schedule.mode,
    target_request_key: requestKey("schedule-upsert"),
  });
  if (error) throw error;
}

export async function saveAppPolicy(input: {
  childId: string;
  parentId: string;
  packageName: string;
  appName: string | null;
  blocked: boolean;
}): Promise<void> {
  const { error } = await v2Supabase.rpc("v2_set_parental_app_policy", {
    target_child_id: input.childId,
    target_package_name: input.packageName,
    target_app_name: input.appName ?? "",
    target_policy_status: input.blocked ? "blocked" : "approved",
    // PostgREST's generated function type does not preserve nullable SQL args.
    target_daily_limit_minutes: null as unknown as number,
    target_always_allowed: false,
    target_request_key: requestKey("app-policy"),
  });
  if (error) throw error;
}

export async function saveDailyScreenTimeLimit(input: {
  childId: string;
  parentId: string;
  minutes: number | null;
}): Promise<void> {
  const { error } = await v2Supabase.rpc("v2_set_screen_time_limit", {
    target_child_id: input.childId,
    requested_minutes: input.minutes as number,
    target_request_key: requestKey("screen-time-limit"),
  });
  if (error) throw error;
}

export async function grantParentBonusTime(input: {
  childId: string;
  parentId: string;
  grantDate: string;
  minutes: number;
}): Promise<void> {
  const { error } = await v2Supabase.rpc("v2_grant_parent_bonus_time", {
    target_child_id: input.childId,
    requested_minutes: input.minutes,
    target_request_key: requestKey("parent-bonus"),
  });
  if (error) throw error;
}

export async function toggleShabbatSchedule(childId: string): Promise<boolean> {
  const { data: existing, error: lookupError } = await v2Supabase
    .from("v2_parental_schedules")
    .select("*")
    .eq("child_id", childId)
    .eq("schedule_type", "shabbat")
    .maybeSingle();

  if (lookupError) throw lookupError;

  const nextActive = existing ? !existing.is_active : true;
  await writeV2Schedule({
    childId,
    scheduleId: existing?.id ?? crypto.randomUUID(),
    name: existing?.name ?? "שבת",
    scheduleType: "shabbat",
    daysOfWeek: existing?.days_of_week ?? null,
    startTime: existing?.start_time ?? null,
    endTime: existing?.end_time ?? null,
    active: nextActive,
    mode: (existing?.mode as "default" | "manual" | undefined) ?? "default",
  });
  return nextActive;
}

export async function saveShabbatMode(input: {
  childId: string;
  scheduleId: string;
  mode: "default" | "manual";
  manualStartTime?: string;
  manualEndTime?: string;
}): Promise<void> {
  const manual = input.mode === "manual";
  const { data: existing, error } = await v2Supabase
    .from("v2_parental_schedules")
    .select("*")
    .eq("id", input.scheduleId)
    .eq("child_id", input.childId)
    .eq("schedule_type", "shabbat")
    .maybeSingle();

  if (error) throw error;
  if (!existing) throw new Error("shabbat_schedule_not_found");
  await writeV2Schedule({
    childId: input.childId,
    scheduleId: existing.id,
    name: existing.name,
    scheduleType: "shabbat",
    daysOfWeek: existing.days_of_week,
    startTime: manual ? input.manualStartTime || null : null,
    endTime: manual ? input.manualEndTime || null : null,
    active: existing.is_active,
    mode: input.mode,
  });
}

export async function createProtectionSchedule(
  childId: string,
  schedule: ScheduleInput,
): Promise<void> {
  await writeV2Schedule({
    childId,
    scheduleId: crypto.randomUUID(),
    name: schedule.name,
    scheduleType: canonicalScheduleType(
      schedule.schedule_type,
      schedule.days_of_week,
    ),
    daysOfWeek: schedule.days_of_week,
    startTime: schedule.start_time,
    endTime: schedule.end_time,
    active: true,
    mode: "manual",
  });
}

export async function updateProtectionSchedule(input: {
  childId: string;
  scheduleId: string;
  patch: SchedulePatch;
}): Promise<void> {
  const { data: existing, error } = await v2Supabase
    .from("v2_parental_schedules")
    .select("*")
    .eq("id", input.scheduleId)
    .eq("child_id", input.childId)
    .maybeSingle();

  if (error) throw error;
  if (!existing) throw new Error("schedule_not_found");

  const daysOfWeek =
    input.patch.days_of_week ?? existing.days_of_week;
  await writeV2Schedule({
    childId: input.childId,
    scheduleId: existing.id,
    name: input.patch.name ?? existing.name,
    scheduleType: canonicalScheduleType(
      existing.schedule_type,
      daysOfWeek,
    ),
    daysOfWeek,
    startTime: input.patch.start_time ?? existing.start_time,
    endTime: input.patch.end_time ?? existing.end_time,
    active: input.patch.is_active ?? existing.is_active,
    mode: (existing.mode as "default" | "manual") ?? "manual",
  });
}

export async function deleteProtectionSchedule(input: {
  childId: string;
  scheduleId: string;
}): Promise<void> {
  const { error } = await v2Supabase.rpc("v2_delete_parental_schedule", {
    target_child_id: input.childId,
    target_schedule_id: input.scheduleId,
    target_request_key: requestKey("schedule-delete"),
  });

  if (error) throw error;
}
