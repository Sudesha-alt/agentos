import { logger } from "./logger";

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  factor?: number;
  jitter?: boolean;
  onRetry?: (err: unknown, attempt: number) => void;
  maxDelayMs?: number;
  /** Merged into retry WARN logs so callers can identify the failing operation. */
  context?: Record<string, unknown>;
}

/**
 * Exponential backoff with optional jitter. We retry on any thrown error.
 * The caller is responsible for classifying which errors are retryable —
 * pass `attempts: 1` for non-idempotent operations.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const factor = options.factor ?? 2;
  const jitter = options.jitter ?? true;

  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isFinalAttempt = i === attempts - 1;
      options.onRetry?.(err, i + 1);

      if (isFinalAttempt) break;

      const delay = baseDelayMs * Math.pow(factor, i);
      const cappedDelay = Math.min(delay, options.maxDelayMs ?? delay);
      const wait = jitter
        ? cappedDelay * (0.5 + Math.random() * 0.5)
        : cappedDelay;
      const errMessage = err instanceof Error ? err.message : String(err);
      const errStatus =
        err && typeof err === "object" && "status" in err
          ? (err as { status?: number }).status
          : undefined;
      logger.warn(
        {
          attempt: i + 1,
          attempts,
          nextRetryMs: Math.round(wait),
          err: errMessage,
          status: errStatus,
          ...options.context,
        },
        "retry after transient failure"
      );
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  throw lastError;
}

export interface WithRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: boolean;
  onRetry?: (err: unknown, attempt: number) => void;
  context?: Record<string, unknown>;
}

// Alias with the configuration shape used in the Layer 2 RAG blueprint.
export function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions = {}
): Promise<T> {
  return retry(fn, {
    attempts: options.maxAttempts,
    baseDelayMs: options.baseDelayMs,
    maxDelayMs: options.maxDelayMs,
    factor: options.factor,
    jitter: options.jitter,
    onRetry: options.onRetry,
    context: options.context,
  });
}
