/**
 * Simple in-memory sliding window rate limiter.
 * Suitable for single-instance internal tools.
 * For multi-instance deployments, replace with Redis-based solution.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 300_000);

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Check and consume a rate limit token.
 * Returns whether the request is allowed.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const resetInSeconds = Math.ceil(
      (oldestInWindow + windowMs - now) / 1000
    );
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.max(resetInSeconds, 1),
    };
  }

  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetInSeconds: Math.ceil(config.windowSeconds),
  };
}

// ── Pre-configured Rate Limits ──────────────────────────────────────────────

/** 10 generations per minute */
export const GENERATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowSeconds: 60,
};

/** 20 run starts per minute */
export const RUN_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowSeconds: 60,
};

/** 5 scheduler heartbeats per minute */
export const SCHEDULER_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowSeconds: 60,
};

/** 30 webhook calls per minute per pipeline */
export const WEBHOOK_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowSeconds: 60,
};
