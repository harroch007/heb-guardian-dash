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
