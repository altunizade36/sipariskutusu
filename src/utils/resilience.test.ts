import { describe, expect, it, vi } from 'vitest';
import { CircuitBreaker, withRetry, withTimeout } from './resilience';

describe('resilience helpers', () => {
  it('fails operation when timeout is exceeded', async () => {
    await expect(
      withTimeout(
        async () =>
          new Promise((resolve) => {
            setTimeout(resolve, 30);
          }),
        {
          timeoutMs: 5,
          name: 'slow-op',
        },
      ),
    ).rejects.toThrow(/timeout/);
  });

  it('retries and succeeds after transient failures', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('ok');

    const result = await withRetry(operation, {
      retries: 3,
      baseDelayMs: 1,
    });

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('opens circuit after threshold and short-circuits next call', async () => {
    const breaker = new CircuitBreaker(
      {
        failureThreshold: 2,
        resetTimeoutMs: 1000,
      },
      'test-breaker',
    );

    await expect(breaker.execute(async () => Promise.reject(new Error('fail-1')))).rejects.toThrow('fail-1');
    await expect(breaker.execute(async () => Promise.reject(new Error('fail-2')))).rejects.toThrow('fail-2');
    await expect(breaker.execute(async () => 'never')).rejects.toThrow(/circuit is open/);
  });
});