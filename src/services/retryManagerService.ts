export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface RetryState {
  attempt: number;
  nextRetryAt: number;
  lastError?: Error;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export class RetryManager {
  static calculateBackoff(config: RetryConfig, attempt: number): number {
    const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelayMs);
  }

  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {},
  ): Promise<T> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < finalConfig.maxAttempts) {
          const delay = this.calculateBackoff(finalConfig, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Max retry attempts exceeded');
  }

  static async executeWithExponentialBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
  ): Promise<T> {
    return this.executeWithRetry(fn, { maxAttempts });
  }

  static shouldRetry(error: any): boolean {
    // Network errors, timeouts, and 5xx errors should be retried
    if (error?.response?.status >= 500) return true;
    if (error?.code === 'ECONNREFUSED') return true;
    if (error?.code === 'ETIMEDOUT') return true;
    if (error?.message?.includes('timeout')) return true;
    return false;
  }

  static getRetryDelay(attempt: number, config: Partial<RetryConfig> = {}): number {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    return this.calculateBackoff(finalConfig, attempt);
  }
}
