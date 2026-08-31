export const ANALYSIS_FAILURE_CLASSES = [
  "provider_transient",
  "configuration",
  "worker_transient",
  "analysis",
] as const;

export type AnalysisFailureClass = typeof ANALYSIS_FAILURE_CLASSES[number];

export interface FailureDisposition {
  retryable: boolean;
  failureClass: AnalysisFailureClass;
}

const FINALIZE_ANALYSIS_REJECTION_CODES = new Set([
  "22023",
  "23505",
  "23514",
]);

export function classifyOpenAIHttpStatus(
  status: number,
): FailureDisposition {
  if (status >= 200 && status < 300) {
    return {
      retryable: true,
      failureClass: "provider_transient",
    };
  }
  const providerTransient = status === 408 ||
    status === 409 ||
    status === 429 ||
    status >= 500;
  if (providerTransient) {
    return {
      retryable: true,
      failureClass: "provider_transient",
    };
  }
  if (status >= 300 && status < 500) {
    return {
      retryable: true,
      failureClass: "configuration",
    };
  }
  return {
    retryable: true,
    failureClass: "provider_transient",
  };
}

export function classifyIncidentCryptoErrorCode(
  code: string,
): FailureDisposition {
  if (
    code === "invalid_private_key" ||
    code === "incident_decryption_failed" ||
    code === "incident_key_unwrap_failed" ||
    code === "incident_payload_auth_failed"
  ) {
    return {
      retryable: true,
      failureClass: "configuration",
    };
  }
  if (code === "unsupported_crypto_buffer") {
    return {
      retryable: true,
      failureClass: "worker_transient",
    };
  }
  return {
    retryable: false,
    failureClass: "analysis",
  };
}

export function classifyUnexpectedAnalyzerError(): FailureDisposition {
  return {
    retryable: true,
    failureClass: "worker_transient",
  };
}

export function classifyFinalizeRpcError(
  value: unknown,
): FailureDisposition & { code: string } {
  const databaseCode = isRecord(value) &&
      typeof value.code === "string"
    ? value.code
    : "";
  return FINALIZE_ANALYSIS_REJECTION_CODES.has(databaseCode)
    ? {
      code: "analysis_finalize_rejected",
      retryable: false,
      failureClass: "analysis",
    }
    : {
      code: "analysis_finalize_transient",
      retryable: true,
      failureClass: "worker_transient",
    };
}

export function classifyFinalizeResponseShapeMismatch():
  & FailureDisposition
  & { code: string } {
  return {
    code: "analysis_finalize_contract_mismatch",
    retryable: true,
    failureClass: "worker_transient",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value);
}
