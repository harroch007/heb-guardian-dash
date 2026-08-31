const CONTRACT_VERSION = 1;

export function settingsRevision(settings: unknown): number | null {
  if (!isRecord(settings)) return null;
  const revision = settings.settings_revision;
  return Number.isSafeInteger(revision) && (revision as number) >= 0
    ? revision as number
    : null;
}

/**
 * Adds only a current, revision-matched contract returned by the per-device
 * service RPC. Invalid, expired and mixed-revision values are removed so the
 * optional field remains fail-closed and backward compatible.
 */
export function withP0PrivateTextActivation(
  settings: unknown,
  activation: unknown,
  nowEpochMs: number = Date.now(),
): unknown {
  if (!isRecord(settings)) return settings;

  const sanitized = { ...settings };
  delete sanitized.p0_private_text_activation;
  const revision = settingsRevision(sanitized);
  if (
    revision === null ||
    !Number.isSafeInteger(nowEpochMs) ||
    nowEpochMs < 0 ||
    !isRecord(activation) ||
    activation.contract_version !== CONTRACT_VERSION ||
    typeof activation.enabled !== "boolean" ||
    !Number.isSafeInteger(activation.valid_until_epoch_ms) ||
    (activation.valid_until_epoch_ms as number) <= nowEpochMs ||
    activation.settings_revision !== revision
  ) {
    return sanitized;
  }

  return {
    ...sanitized,
    p0_private_text_activation: {
      contract_version: CONTRACT_VERSION,
      enabled: activation.enabled,
      valid_until_epoch_ms: activation.valid_until_epoch_ms,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
