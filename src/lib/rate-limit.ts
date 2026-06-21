/**
 * Process-local rate limiter — fine for single-container Lightsail MVP.
 * Replace with a Redis-backed limiter when the stack scales to multiple web
 * containers. API is intentionally trivial so the swap is mechanical.
 */
type Bucket = "register" | "login" | "forgot" | "upload" | "draft" | "lead";

interface Hit {
  count: number;
  resetAt: number;
}

const store = new Map<string, Hit>();

/** Flush all stored counters — only for use in test environments. */
export function clearAllRateLimits() {
  store.clear();
}

export async function rateLimit(opts: {
  bucket: Bucket;
  key: string;
  limit: number;
  windowSec: number;
}): Promise<{ ok: boolean; remaining: number; resetIn: number }> {
  // Bypass rate limiting entirely when the test-reset flag is set.
  if (process.env.ALLOW_TEST_RESET === "1") {
    return { ok: true, remaining: opts.limit - 1, resetIn: opts.windowSec };
  }
  const k = `${opts.bucket}:${opts.key}`;
  const now = Date.now();
  const winMs = opts.windowSec * 1000;
  const existing = store.get(k);

  if (!existing || existing.resetAt <= now) {
    store.set(k, { count: 1, resetAt: now + winMs });
    return { ok: true, remaining: opts.limit - 1, resetIn: opts.windowSec };
  }
  if (existing.count >= opts.limit) {
    return { ok: false, remaining: 0, resetIn: Math.ceil((existing.resetAt - now) / 1000) };
  }
  existing.count += 1;
  return { ok: true, remaining: opts.limit - existing.count, resetIn: Math.ceil((existing.resetAt - now) / 1000) };
}

// Periodic sweep so the Map doesn't grow unbounded.
if (typeof setInterval === "function") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
  }, 60_000).unref?.();
}
