const WINDOW_MS = 60_000;
const MAX_REQUESTS = 1;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkTourGenerateRateLimit(repoKey: string): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  let bucket = buckets.get(repoKey);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(repoKey, bucket);
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
