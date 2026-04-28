type TimeoutOptions = {
  timeoutMs: number;
  name: string;
};

type RetryOptions = {
  retries: number;
  baseDelayMs: number;
  shouldRetry?: (error: unknown) => boolean;
};

type CircuitBreakerOptions = {
  failureThreshold: number;
  resetTimeoutMs: number;
};

type BreakerState = 'closed' | 'open' | 'half-open';

const defaultRetryCheck = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('temporarily') ||
    message.includes('429') ||
    message.includes('503')
  );
};

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withTimeout<T>(operation: () => Promise<T>, options: TimeoutOptions): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${options.name} timeout after ${options.timeoutMs}ms`));
      }, options.timeoutMs);
    });

    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const shouldRetry = options.shouldRetry ?? defaultRetryCheck;
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= options.retries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === options.retries || !shouldRetry(error)) {
        throw error;
      }

      const backoff = options.baseDelayMs * Math.pow(2, attempt);
      await delay(backoff);
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Operation failed after retries.');
}

export class CircuitBreaker {
  private state: BreakerState = 'closed';
  private failures = 0;
  private openedAt = 0;

  constructor(private readonly options: CircuitBreakerOptions, private readonly name: string) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state === 'open') {
      if (now - this.openedAt < this.options.resetTimeoutMs) {
        throw new Error(`${this.name} circuit is open`);
      }
      this.state = 'half-open';
    }

    try {
      const result = await operation();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= this.options.failureThreshold) {
        this.state = 'open';
        this.openedAt = now;
      }
      throw error;
    }
  }
}