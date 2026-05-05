export class Debounce {
  static create<T extends (...args: any[]) => any>(
    fn: T,
    delay: number,
    options: { leading?: boolean; trailing?: boolean } = {},
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const { leading = false, trailing = true } = options;
    let lastCallTime = 0;
    let leadingExecution = false;

    return function (this: any, ...args: Parameters<T>) {
      const now = Date.now();

      if (leading && !leadingExecution && now - lastCallTime >= delay) {
        fn.apply(this, args);
        leadingExecution = true;
      }

      lastCallTime = now;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (trailing) {
        timeoutId = setTimeout(() => {
          fn.apply(this, args);
          leadingExecution = false;
          timeoutId = undefined;
        }, delay);
      }
    };
  }

  static promise<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    delay: number,
  ): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastPromise: Promise<any> | undefined;

    return function (this: any, ...args: Parameters<T>) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      return new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await fn.apply(this, args);
            lastPromise = Promise.resolve(result);
            resolve(result);
          } catch (error) {
            lastPromise = Promise.reject(error);
            reject(error);
          }
        }, delay);
      });
    };
  }

  static cancel(fn: any) {
    // Note: This requires the debounced function to have a cancel method attached
    if (typeof fn === 'function' && 'cancel' in fn) {
      (fn as any).cancel();
    }
  }
}

export class Throttle {
  static create<T extends (...args: any[]) => any>(
    fn: T,
    interval: number,
    options: { leading?: boolean; trailing?: boolean } = {},
  ): (...args: Parameters<T>) => void {
    let lastExecutionTime = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const { leading = true, trailing = false } = options;
    let lastArgs: Parameters<T> | undefined;

    return function (this: any, ...args: Parameters<T>) {
      const now = Date.now();
      lastArgs = args;

      if (leading && now - lastExecutionTime >= interval) {
        fn.apply(this, args);
        lastExecutionTime = now;
        return;
      }

      if (trailing) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
          if (lastArgs && now - lastExecutionTime >= interval) {
            fn.apply(this, lastArgs);
            lastExecutionTime = Date.now();
          }
        }, interval - (now - lastExecutionTime));
      }
    };
  }

  static promise<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    interval: number,
  ): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | undefined> {
    let lastExecutionTime = 0;
    let lastPromise: Promise<any> | undefined;

    return async function (this: any, ...args: Parameters<T>) {
      const now = Date.now();

      if (now - lastExecutionTime >= interval) {
        try {
          const result = await fn.apply(this, args);
          lastExecutionTime = now;
          lastPromise = Promise.resolve(result);
          return result;
        } catch (error) {
          lastPromise = Promise.reject(error);
          throw error;
        }
      }

      return lastPromise;
    };
  }
}

export class RateLimit {
  static create<T extends (...args: any[]) => any>(
    fn: T,
    maxCalls: number,
    windowMs: number,
  ): (...args: Parameters<T>) => void | Promise<void> {
    let callTimes: number[] = [];

    return function (this: any, ...args: Parameters<T>) {
      const now = Date.now();

      // Remove old calls outside window
      callTimes = callTimes.filter((time) => now - time < windowMs);

      if (callTimes.length < maxCalls) {
        callTimes.push(now);
        fn.apply(this, args);
      } else {
        console.warn(
          `Rate limit exceeded: ${maxCalls} calls per ${windowMs}ms`,
        );
      }
    };
  }
}

export class Memoize {
  static create<T extends (...args: any[]) => any>(
    fn: T,
    options: { maxSize?: number; ttl?: number } = {},
  ): (...args: Parameters<T>) => ReturnType<T> {
    const cache = new Map<string, { value: any; timestamp: number }>();
    const { maxSize = 100, ttl = Infinity } = options;

    return function (this: any, ...args: Parameters<T>) {
      const key = JSON.stringify(args);
      const cached = cache.get(key);

      if (cached) {
        if (ttl === Infinity || Date.now() - cached.timestamp < ttl) {
          return cached.value;
        }
        cache.delete(key);
      }

      const result = fn.apply(this, args);

      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      cache.set(key, { value: result, timestamp: Date.now() });
      return result;
    };
  }

  static clearCache(fn: any) {
    if (typeof fn === 'function' && 'cache' in fn) {
      (fn as any).cache.clear();
    }
  }
}
