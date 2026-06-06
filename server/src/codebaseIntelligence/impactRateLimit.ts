const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkImpactRateLimit(clientKey: string): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  let bucket = buckets.get(clientKey);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(clientKey, bucket);
  }

  if (bucket.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}
