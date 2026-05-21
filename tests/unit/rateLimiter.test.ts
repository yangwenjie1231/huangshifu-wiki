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

  beforeEach(() => {
    vi.resetModules();
    rateLimitMock.mockClear();
    ipKeyGeneratorMock.mockClear();
    process.env.NODE_ENV = 'development';
    delete process.env.DEV_DISABLE_RATE_LIMIT;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDevDisableRateLimit === undefined) {
      delete process.env.DEV_DISABLE_RATE_LIMIT;
    } else {
      process.env.DEV_DISABLE_RATE_LIMIT = originalDevDisableRateLimit;
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
});
