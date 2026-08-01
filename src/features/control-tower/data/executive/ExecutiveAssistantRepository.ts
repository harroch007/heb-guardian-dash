import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export type CeoChangeTaskState =
  | "draft"
  | "proposed"
  | "approved"
  | "claimed"
  | "running"
  | "validation_failed"
  | "ready_for_review"
  | "completed"
  | "failed"
  | "cancelled";

export interface ExecutiveBriefing {
  readonly generatedAt: string;
  readonly caseCountsByStatus: Readonly<Record<string, number>>;
  readonly caseCountsByPriority: Readonly<Record<string, number>>;
  readonly deviceCountsByStatus: Readonly<Record<string, number>>;
  readonly monitoringCountsByState: Readonly<Record<string, number>>;
  readonly parentalControls: {
    readonly configuredChildren: number;
    readonly activeSchedules: number;
    readonly activeGeofences: number;
    readonly blockedAttemptsLast24h: number;
  };
  readonly agentRuntime: {
    readonly runsLast24h: number;
    readonly failedClosedLast24h: number;
    readonly deadLetterJobs: number;
  };
  readonly changeTasksByStatus: Readonly<Record<string, number>>;
  readonly runnerState: "not_configured" | "available" | "offline" | "revoked";
}

export interface CeoChangeTask {
  readonly taskId: string;
  readonly title: string;
  readonly objectiveSummary: string;
  readonly repositoryKey: string;
  readonly allowedPathScopes: readonly string[];
  readonly requiredCheckCodes: readonly string[];
  readonly aggregateContextRefs: readonly string[];
  readonly status: CeoChangeTaskState;
  readonly runnerState: ExecutiveBriefing["runnerState"];
  readonly executionPath: "trusted_external_runner";
  readonly humanApprovalRequired: true;
  readonly isolatedWorktreeRequired: true;
  readonly pullRequestRequired: true;
  readonly testsRequired: true;
  readonly safeResultCode: string | null;
  readonly approvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProposeCeoChangeTaskInput {
  readonly idempotencyKey: string;
  readonly title: string;
  readonly objectiveSummary: string;
  readonly repositoryKey: string;
  readonly allowedPathScopes: readonly string[];
  readonly requiredCheckCodes: readonly string[];
  readonly aggregateContextRefs: readonly string[];
}

export type ExecutiveRepositoryResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: { readonly safeMessage: string; readonly retryable: boolean } };

export interface ExecutiveAssistantRepository {
  getBriefing(signal?: AbortSignal): Promise<ExecutiveRepositoryResult<ExecutiveBriefing>>;
  listChangeTasks(signal?: AbortSignal): Promise<ExecutiveRepositoryResult<readonly CeoChangeTask[]>>;
  proposeChangeTask(input: ProposeCeoChangeTaskInput): Promise<ExecutiveRepositoryResult<{ taskId: string; status: CeoChangeTaskState; runnerState: ExecutiveBriefing["runnerState"] }>>;
  approveChangeTask(taskId: string): Promise<ExecutiveRepositoryResult<{ status: "approved"; runnerState: ExecutiveBriefing["runnerState"] }>>;
  cancelChangeTask(taskId: string): Promise<ExecutiveRepositoryResult<{ status: "cancelled" }>>;
}

const countsSchema = z.record(z.number().int().nonnegative());
const runnerStateSchema = z.enum(["not_configured", "available", "offline", "revoked"]);
const stateSchema = z.enum([
  "draft", "proposed", "approved", "claimed", "running",
  "validation_failed", "ready_for_review", "completed", "failed", "cancelled",
]);

const briefingEnvelopeSchema = z.object({
  schema_version: z.literal(1),
  generated_at: z.string().datetime({ offset: true }),
  source_mode: z.literal("staging"),
  data: z.object({
    case_counts_by_status: countsSchema,
    case_counts_by_priority: countsSchema,
    device_counts_by_status: countsSchema,
    monitoring_counts_by_state: countsSchema,
    parental_controls: z.object({
      configured_children: z.number().int().nonnegative(),
      active_schedules: z.number().int().nonnegative(),
      active_geofences: z.number().int().nonnegative(),
      blocked_attempts_last_24h: z.number().int().nonnegative(),
    }).strict(),
    agent_runtime: z.object({
      runs_last_24h: z.number().int().nonnegative(),
      failed_closed_last_24h: z.number().int().nonnegative(),
      dead_letter_jobs: z.number().int().nonnegative(),
    }).strict(),
    change_tasks_by_status: countsSchema,
    runner_state: runnerStateSchema,
    privacy_boundary: z.object({
      aggregate_only: z.literal(true),
      raw_child_content: z.literal(false),
      customer_channel: z.literal(false),
    }).strict(),
  }).strict(),
  page: z.null(),
  audit_event_id: z.union([z.string(), z.number().int()]),
}).strict();

const taskSchema = z.object({
  task_id: z.string().uuid(),
  title: z.string().min(1).max(160),
  objective_summary: z.string().min(1).max(2000),
  repository_key: z.string().min(2).max(120),
  allowed_path_scopes: z.array(z.string()).min(1).max(32),
  required_check_codes: z.array(z.string()).max(32),
  aggregate_context_refs: z.array(z.string()).max(64),
  status: stateSchema,
  runner_state: runnerStateSchema,
  execution_path: z.literal("trusted_external_runner"),
  human_approval_required: z.literal(true),
  isolated_worktree_required: z.literal(true),
  pull_request_required: z.literal(true),
  tests_required: z.literal(true),
  safe_result_code: z.string().nullable(),
  approved_at: z.string().datetime({ offset: true }).nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}).strict();

const taskListEnvelopeSchema = z.object({
  schema_version: z.literal(1),
  generated_at: z.string().datetime({ offset: true }),
  source_mode: z.literal("staging"),
  data: z.array(taskSchema).max(100),
  page: z.object({ limit: z.number().int().min(1).max(100) }).strict(),
  audit_event_id: z.union([z.string(), z.number().int()]),
}).strict();

const taskMutationSchema = z.object({
  schema_version: z.literal(1),
  task_id: z.string().uuid(),
  status: stateSchema,
  runner_state: runnerStateSchema.optional(),
  duplicate: z.boolean().optional(),
  audit_event_id: z.union([z.string(), z.number().int()]).optional(),
}).strict();

type ExecutiveRpcName =
  | "v2_admin_get_executive_operational_summary"
  | "v2_admin_list_ceo_change_tasks"
  | "v2_admin_create_ceo_change_task"
  | "v2_admin_approve_ceo_change_task"
  | "v2_admin_cancel_ceo_change_task";

interface RpcBuilder extends PromiseLike<{ readonly data: unknown; readonly error: unknown | null }> {
  abortSignal(signal: AbortSignal): RpcBuilder;
}

async function rpc(
  name: ExecutiveRpcName,
  arguments_: Readonly<Record<string, unknown>>,
  signal?: AbortSignal,
): Promise<{ data: unknown; error: unknown | null }> {
  const invoke = supabase.rpc.bind(supabase) as unknown as (
    rpcName: string,
    values: Readonly<Record<string, unknown>>,
  ) => RpcBuilder;
  const request = invoke(name, arguments_);
  return await (signal ? request.abortSignal(signal) : request);
}

export class RemoteExecutiveAssistantRepository implements ExecutiveAssistantRepository {
  async getBriefing(signal?: AbortSignal): Promise<ExecutiveRepositoryResult<ExecutiveBriefing>> {
    const execution = await safeRpc("v2_admin_get_executive_operational_summary", {}, signal);
    if (execution.ok === false) return execution;
    const decoded = briefingEnvelopeSchema.safeParse(execution.data);
    if (!decoded.success) return malformed();
    const value = decoded.data;
    return { ok: true, data: {
      generatedAt: value.generated_at,
      caseCountsByStatus: value.data.case_counts_by_status,
      caseCountsByPriority: value.data.case_counts_by_priority,
      deviceCountsByStatus: value.data.device_counts_by_status,
      monitoringCountsByState: value.data.monitoring_counts_by_state,
      parentalControls: {
        configuredChildren: value.data.parental_controls.configured_children,
        activeSchedules: value.data.parental_controls.active_schedules,
        activeGeofences: value.data.parental_controls.active_geofences,
        blockedAttemptsLast24h: value.data.parental_controls.blocked_attempts_last_24h,
      },
      agentRuntime: {
        runsLast24h: value.data.agent_runtime.runs_last_24h,
        failedClosedLast24h: value.data.agent_runtime.failed_closed_last_24h,
        deadLetterJobs: value.data.agent_runtime.dead_letter_jobs,
      },
      changeTasksByStatus: value.data.change_tasks_by_status,
      runnerState: value.data.runner_state,
    } };
  }

  async listChangeTasks(signal?: AbortSignal): Promise<ExecutiveRepositoryResult<readonly CeoChangeTask[]>> {
    const execution = await safeRpc("v2_admin_list_ceo_change_tasks", { target_limit: 50 }, signal);
    if (execution.ok === false) return execution;
    const decoded = taskListEnvelopeSchema.safeParse(execution.data);
    if (!decoded.success) return malformed();
    return { ok: true, data: decoded.data.data.map(mapTask) };
  }

  async proposeChangeTask(input: ProposeCeoChangeTaskInput): Promise<ExecutiveRepositoryResult<{ taskId: string; status: CeoChangeTaskState; runnerState: ExecutiveBriefing["runnerState"] }>> {
    const execution = await safeRpc("v2_admin_create_ceo_change_task", {
      target_idempotency_key: input.idempotencyKey,
      target_title: input.title,
      target_objective_summary: input.objectiveSummary,
      target_repository_key: input.repositoryKey,
      target_allowed_path_scopes: [...input.allowedPathScopes],
      target_required_check_codes: [...input.requiredCheckCodes],
      target_aggregate_context_refs: [...input.aggregateContextRefs],
      target_contains_raw_child_content: false,
    });
    if (execution.ok === false) return execution;
    const decoded = taskMutationSchema.safeParse(execution.data);
    if (!decoded.success) return malformed();
    return { ok: true as const, data: {
      taskId: decoded.data.task_id,
      status: decoded.data.status,
      runnerState: decoded.data.runner_state ?? "not_configured" as const,
    } };
  }

  async approveChangeTask(taskId: string): Promise<ExecutiveRepositoryResult<{ status: "approved"; runnerState: ExecutiveBriefing["runnerState"] }>> {
    const execution = await safeRpc("v2_admin_approve_ceo_change_task", { target_task_id: taskId });
    if (execution.ok === false) return execution;
    const decoded = taskMutationSchema.safeParse(execution.data);
    if (!decoded.success || decoded.data.status !== "approved") return malformed();
    return { ok: true as const, data: {
      status: "approved" as const,
      runnerState: decoded.data.runner_state ?? "not_configured" as const,
    } };
  }

  async cancelChangeTask(taskId: string): Promise<ExecutiveRepositoryResult<{ status: "cancelled" }>> {
    const execution = await safeRpc("v2_admin_cancel_ceo_change_task", { target_task_id: taskId });
    if (execution.ok === false) return execution;
    const decoded = taskMutationSchema.safeParse(execution.data);
    if (!decoded.success || decoded.data.status !== "cancelled") return malformed();
    return { ok: true as const, data: { status: "cancelled" as const } };
  }
}

function mapTask(task: z.infer<typeof taskSchema>): CeoChangeTask {
  return {
    taskId: task.task_id,
    title: task.title,
    objectiveSummary: task.objective_summary,
    repositoryKey: task.repository_key,
    allowedPathScopes: task.allowed_path_scopes,
    requiredCheckCodes: task.required_check_codes,
    aggregateContextRefs: task.aggregate_context_refs,
    status: task.status,
    runnerState: task.runner_state,
    executionPath: task.execution_path,
    humanApprovalRequired: task.human_approval_required,
    isolatedWorktreeRequired: task.isolated_worktree_required,
    pullRequestRequired: task.pull_request_required,
    testsRequired: task.tests_required,
    safeResultCode: task.safe_result_code,
    approvedAt: task.approved_at,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

async function safeRpc(
  name: ExecutiveRpcName,
  arguments_: Readonly<Record<string, unknown>>,
  signal?: AbortSignal,
): Promise<ExecutiveRepositoryResult<unknown>> {
  try {
    const execution = await rpc(name, arguments_, signal);
    if (execution.error) {
      const message = String((execution.error as { message?: unknown }).message ?? "");
      const forbidden = message.includes("ceo_private_access_required") || message.includes("42501");
      return { ok: false, error: {
        safeMessage: forbidden
          ? "הגישה לעוזרת הפרטית מותרת למנכ״ל עם אימות AAL2 בלבד."
          : "שירות העוזרת הפרטית עדיין אינו זמין בסביבה זו.",
        retryable: !forbidden,
      } };
    }
    return { ok: true, data: execution.data };
  } catch {
    return { ok: false, error: {
      safeMessage: "שירות העוזרת הפרטית עדיין אינו זמין בסביבה זו.",
      retryable: true,
    } };
  }
}

function malformed<T>(): ExecutiveRepositoryResult<T> {
  return { ok: false, error: {
    safeMessage: "העוזרת החזירה חוזה נתונים שאינו נתמך.",
    retryable: false,
  } };
}

export function createExecutiveAssistantRepository(): ExecutiveAssistantRepository {
  return new RemoteExecutiveAssistantRepository();
}
