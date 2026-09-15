export function isOpenAIDataRetentionPolicyAcknowledged(
  zdrApproved: string | undefined,
  standardRetentionAcknowledged: string | undefined,
): boolean {
  return zdrApproved === "true" || standardRetentionAcknowledged === "true";
}
