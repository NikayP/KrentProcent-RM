import test from 'node:test';
import assert from 'node:assert/strict';
import { SlidingWindowRateLimiter, getClientIp } from './rateLimit.ts';

test('SlidingWindowRateLimiter allows up to maxRequests and blocks excess until window expires', () => {
  const limiter = new SlidingWindowRateLimiter({ windowMs: 10_000, maxRequests: 2 });
  const t0 = 1_000_000;

  assert.equal(limiter.check('1.2.3.4', t0).allowed, true);
  assert.equal(limiter.check('1.2.3.4', t0 + 1000).allowed, true);

  const blocked = limiter.check('1.2.3.4', t0 + 2000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfterSeconds, 8);

  // Different IP is unaffected
  assert.equal(limiter.check('5.6.7.8', t0 + 2000).allowed, true);

  // After window slides past first hit, request is allowed again
  assert.equal(limiter.check('1.2.3.4', t0 + 10_001).allowed, true);
});

test('SlidingWindowRateLimiter caps stored keys to prevent unbounded memory growth', () => {
  const limiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 5, maxKeys: 3 });
  const now = 500_000;

  for (let i = 0; i < 10; i++) {
    assert.equal(limiter.check(`ip-${i}`, now + i).allowed, true);
  }
});

test('getClientIp extracts first x-forwarded-for IP, x-real-ip, or socket address', () => {
  assert.equal(
    getClientIp({ headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' } } as any),
    '203.0.113.5'
  );
  assert.equal(
    getClientIp({ headers: { 'x-real-ip': '198.51.100.7' } } as any),
    '198.51.100.7'
  );
  assert.equal(
    getClientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } } as any),
    '127.0.0.1'
  );
});
