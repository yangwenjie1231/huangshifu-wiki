import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rateLimitMock = vi.fn((options) => options);
const ipKeyGeneratorMock = vi.fn((ip: string) => ip);

vi.mock('express-rate-limit', () => ({
  default: rateLimitMock,
  ipKeyGenerator: ipKeyGeneratorMock,
}));

describe('rateLimiter', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevDisableRateLimit = process.env.DEV_DISABLE_RATE_LIMIT;
  const originalVitest = process.env.VITEST;
  const originalVitestWorkerId = process.env.VITEST_WORKER_ID;

  beforeEach(() => {
    vi.resetModules();
    rateLimitMock.mockClear();
    ipKeyGeneratorMock.mockClear();
    process.env.NODE_ENV = 'development';
    delete process.env.DEV_DISABLE_RATE_LIMIT;
    delete process.env.VITEST;
    delete process.env.VITEST_WORKER_ID;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDevDisableRateLimit === undefined) {
      delete process.env.DEV_DISABLE_RATE_LIMIT;
    } else {
      process.env.DEV_DISABLE_RATE_LIMIT = originalDevDisableRateLimit;
    }

    if (originalVitest === undefined) {
      delete process.env.VITEST;
    } else {
      process.env.VITEST = originalVitest;
    }

    if (originalVitestWorkerId === undefined) {
      delete process.env.VITEST_WORKER_ID;
    } else {
      process.env.VITEST_WORKER_ID = originalVitestWorkerId;
    }
  });

  it('keeps rate limiting enabled by default in development', async () => {
    const { globalLimiter, isRateLimitDisabledInDevelopment } = await import(
      '../../src/server/middleware/rateLimiter'
    );

    expect(globalLimiter).toBeDefined();
    expect(isRateLimitDisabledInDevelopment()).toBe(false);

    const [{ skip }] = rateLimitMock.mock.calls.at(-1)!;
    expect(skip({}, {})).toBe(false);
  });

  it('allows disabling rate limiting explicitly in development', async () => {
    process.env.DEV_DISABLE_RATE_LIMIT = 'true';

    const { globalLimiter, isRateLimitDisabledInDevelopment } = await import(
      '../../src/server/middleware/rateLimiter'
    );

    expect(globalLimiter).toBeDefined();
    expect(isRateLimitDisabledInDevelopment()).toBe(true);

    const [{ skip }] = rateLimitMock.mock.calls.at(-1)!;
    expect(skip({}, {})).toBe(true);
  });

  it('honors env values loaded after module import', async () => {
    const { globalLimiter, isRateLimitDisabledInDevelopment } = await import(
      '../../src/server/middleware/rateLimiter'
    );

    process.env.DEV_DISABLE_RATE_LIMIT = 'true';

    expect(globalLimiter).toBeDefined();
    expect(isRateLimitDisabledInDevelopment()).toBe(true);

    const [{ skip }] = rateLimitMock.mock.calls.at(-1)!;
    expect(skip({}, {})).toBe(true);
  });

  it('does not disable rate limiting in production even when the flag is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_DISABLE_RATE_LIMIT = 'true';

    const { globalLimiter, isRateLimitDisabledInDevelopment } = await import(
      '../../src/server/middleware/rateLimiter'
    );

    expect(globalLimiter).toBeDefined();
    expect(isRateLimitDisabledInDevelopment()).toBe(false);

    const [{ skip }] = rateLimitMock.mock.calls.at(-1)!;
    expect(skip({}, {})).toBe(false);
  });

  it('disables rate limiting automatically in test environment', async () => {
    process.env.VITEST = 'true';
    process.env.VITEST_WORKER_ID = '1';
    delete process.env.DEV_DISABLE_RATE_LIMIT;

    const { globalLimiter, isRateLimitDisabledInDevelopment } = await import(
      '../../src/server/middleware/rateLimiter'
    );

    expect(globalLimiter).toBeDefined();
    expect(isRateLimitDisabledInDevelopment()).toBe(true);

    const [{ skip }] = rateLimitMock.mock.calls.at(-1)!;
    expect(skip({}, {})).toBe(true);
  });

  it('uses separate limiter instances for password reset request and confirmation', async () => {
    const {
      passwordResetConfirmLimiter,
      passwordResetRequestLimiter,
    } = await import('../../src/server/middleware/rateLimiter');

    expect(passwordResetRequestLimiter).toBeDefined();
    expect(passwordResetConfirmLimiter).toBeDefined();
    expect(passwordResetRequestLimiter).not.toBe(passwordResetConfirmLimiter);

    const requestLimiterOptions = rateLimitMock.mock.calls
      .map(([options]) => options)
      .find((options) => options.message?.error === '密码找回请求过于频繁，请15分钟后再试');
    const confirmLimiterOptions = rateLimitMock.mock.calls
      .map(([options]) => options)
      .find((options) => options.message?.error === '密码重置确认过于频繁，请15分钟后再试');

    expect(requestLimiterOptions).toBeDefined();
    expect(confirmLimiterOptions).toBeDefined();
    expect(requestLimiterOptions).not.toBe(confirmLimiterOptions);
  });
});
