import type { IsoDateTime, StaffId } from "../domain/types";

export type MarketingId = string;
export type MarketingStage = "PRELAUNCH" | "FREE" | "VOICE" | "PREMIUM";
export type MarketingChannel = "FACEBOOK_PAGE" | "WEBSITE" | "FOUNDER" | "OTHER_ORGANIC";
export type MarketingWorkflowStatus =
  | "DRAFT"
  | "POLICY_REVIEW"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "VERIFIED"
  | "REJECTED"
  | "FAILED"
  | "CANCELLED";

export type ClaimGateResult = "PASS" | "REVISE" | "BLOCK";

export interface CampaignBrief {
  id: MarketingId;
  objective: string;
  audience: string;
  stage: MarketingStage;
  channel: MarketingChannel;
  hypothesis: string;
  singleCta: string;
  successSignals: readonly string[];
  constraints: readonly string[];
  sourceVersions: Readonly<Record<string, string>>;
  owner: StaffId;
  status: MarketingWorkflowStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ContentItem {
  id: MarketingId;
  briefId: MarketingId;
  format: string;
  copy: Readonly<Record<string, unknown>>;
  creativeRefs: readonly MarketingId[];
  claimRefs: readonly string[];
  utm: Readonly<Record<string, string>>;
  claimGateResult: ClaimGateResult;
  status: MarketingWorkflowStatus;
  contentHash: string;
}

export interface ApprovalRequest {
  id: MarketingId;
  resourceType: "CAMPAIGN_BRIEF" | "CONTENT_ITEM" | "CREATIVE_ASSET" | "PUBLICATION_JOB";
  resourceId: MarketingId;
  contentHash: string;
  preview: Readonly<Record<string, unknown>>;
  risk: "LOW" | "MEDIUM" | "HIGH";
  requestedAt: IsoDateTime;
  expiresAt: IsoDateTime;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED";
  approver: StaffId | null;
}

export interface PublicationJob {
  id: MarketingId;
  resourceId: MarketingId;
  channel: MarketingChannel;
  scheduledFor: IsoDateTime | null;
  idempotencyKey: string;
  approvalId: MarketingId;
  status: MarketingWorkflowStatus;
  providerRef: string | null;
  verifiedAt: IsoDateTime | null;
}

export interface MetricSnapshot {
  briefId: MarketingId;
  periodStart: IsoDateTime;
  periodEnd: IsoDateTime;
  source: string;
  dimensions: Readonly<Record<string, string>>;
  metrics: Readonly<Record<string, number>>;
  collectedAt: IsoDateTime;
  dataQuality: "VALID" | "PARTIAL" | "STALE" | "INVALID";
}
