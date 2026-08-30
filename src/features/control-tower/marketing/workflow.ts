import type { MarketingWorkflowStatus } from "./contracts";

const TRANSITIONS: Readonly<Record<MarketingWorkflowStatus, readonly MarketingWorkflowStatus[]>> = {
  DRAFT: ["POLICY_REVIEW", "CANCELLED"],
  POLICY_REVIEW: ["AWAITING_APPROVAL", "DRAFT", "CANCELLED"],
  AWAITING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["PUBLISHED", "FAILED", "CANCELLED"],
  PUBLISHED: ["VERIFIED", "FAILED"],
  VERIFIED: [],
  REJECTED: ["DRAFT", "CANCELLED"],
  FAILED: ["SCHEDULED", "CANCELLED"],
  CANCELLED: [],
};

export function canTransitionMarketingWorkflow(
  from: MarketingWorkflowStatus,
  to: MarketingWorkflowStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function requiresFreshApprovalAfterContentChange(status: MarketingWorkflowStatus): boolean {
  return ["AWAITING_APPROVAL", "APPROVED", "SCHEDULED", "PUBLISHED"].includes(status);
}

export function nextStatusAfterContentChange(status: MarketingWorkflowStatus): MarketingWorkflowStatus {
  return requiresFreshApprovalAfterContentChange(status) ? "POLICY_REVIEW" : status;
}
