import type { VercelRequest } from '@vercel/node';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  maxKeys?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Lightweight in-memory sliding-window rate limiter.
 * Works immediately in local dev and throttles bursts on warm serverless instances
 * with zero external dependencies (can be paired with Vercel Firewall in production).
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxKeys: number;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.maxKeys = options.maxKeys ?? 5000;
  }

  check(key: string, now = Date.now()): RateLimitResult {
    const windowStart = now - this.windowMs;
    const existing = this.hits.get(key);
    const recent = existing ? existing.filter((ts) => ts > windowStart) : [];

    if (recent.length >= this.maxRequests) {
      const oldestInWindow = recent[0];
      const retryAfterMs = Math.max(1000, oldestInWindow + this.windowMs - now);
      this.hits.set(key, recent);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    recent.push(now);
    // Refresh insertion order for simple LRU eviction if map grows large
    this.hits.delete(key);
    this.hits.set(key, recent);

    if (this.hits.size > this.maxKeys) {
      this.prune(windowStart);
    }

    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - recent.length),
      retryAfterSeconds: 0,
    };
  }

  private prune(windowStart: number): void {
    for (const [k, timestamps] of this.hits.entries()) {
      const recent = timestamps.filter((ts) => ts > windowStart);
      if (recent.length === 0) {
        this.hits.delete(k);
      } else {
        this.hits.set(k, recent);
      }
      if (this.hits.size <= this.maxKeys) break;
    }

    // Hard cap fallback if all keys are still active
    while (this.hits.size > this.maxKeys) {
      const oldestKey = this.hits.keys().next().value;
      if (oldestKey === undefined) break;
      this.hits.delete(oldestKey);
    }
  }
}

export function getClientIp(req: Pick<VercelRequest, 'headers' | 'socket'>): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0].trim();
  }
  const realIp = req.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}
