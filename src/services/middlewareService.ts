export interface Middleware<T, U> {
  process(data: T): Promise<U>;
}

export interface RequestInterceptor {
  (config: any): any | Promise<any>;
}

export interface ResponseInterceptor {
  (response: any): any | Promise<any>;
}

export interface ErrorInterceptor {
  (error: Error): Error | Promise<Error>;
}

export class MiddlewareChain<T, U> {
  private middlewares: Middleware<any, any>[] = [];

  add<V>(middleware: Middleware<any, V>): MiddlewareChain<T, V> {
    this.middlewares.push(middleware);
    return this as any;
  }

  async execute(data: T): Promise<U> {
    let result: any = data;

    for (const middleware of this.middlewares) {
      result = await middleware.process(result);
    }

    return result;
  }

  async executeParallel(data: T): Promise<U[]> {
    const results = await Promise.all(
      this.middlewares.map((middleware) => middleware.process(data)),
    );

    return results;
  }
}

export class InterceptorManager {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  async executeRequestInterceptors(config: any): Promise<any> {
    let result = config;

    for (const interceptor of this.requestInterceptors) {
      result = await interceptor(result);
    }

    return result;
  }

  async executeResponseInterceptors(response: any): Promise<any> {
    let result = response;

    for (const interceptor of this.responseInterceptors) {
      result = await interceptor(result);
    }

    return result;
  }

  async executeErrorInterceptors(error: Error): Promise<Error> {
    let result = error;

    for (const interceptor of this.errorInterceptors) {
      result = await interceptor(result);
    }

    return result;
  }
}

export class PipelineBuilder<T, U = T> {
  private stages: Array<(data: any) => Promise<any>> = [];

  add<V>(fn: (data: T) => Promise<V>): PipelineBuilder<T, V> {
    this.stages.push(fn);
    return this as any;
  }

  async execute(data: T): Promise<U> {
    let result: any = data;

    for (const stage of this.stages) {
      result = await stage(result);
    }

    return result;
  }

  async executeWithFallback(data: T, fallback: U): Promise<U> {
    try {
      return await this.execute(data);
    } catch (error) {
      console.error('Pipeline execution failed:', error);
      return fallback;
    }
  }

  async executeWithRetry(data: T, maxRetries: number = 3): Promise<U> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.execute(data);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Pipeline failed after retries');
  }
}

export class ComposableFunction<T, U> {
  constructor(private fn: (data: T) => U) {}

  map<V>(fn: (data: U) => V): ComposableFunction<T, V> {
    return new ComposableFunction((data: T) => fn(this.fn(data)));
  }

  flatMap<V>(fn: (data: U) => ComposableFunction<T, V>): ComposableFunction<T, V> {
    return new ComposableFunction((data: T) => fn(this.fn(data)).execute(data));
  }

  filter(predicate: (data: U) => boolean): ComposableFunction<T, U | null> {
    return new ComposableFunction((data: T) => {
      const result = this.fn(data);
      return predicate(result) ? result : null;
    });
  }

  execute(data: T): U {
    return this.fn(data);
  }

  compose<V>(fn: ComposableFunction<U, V>): ComposableFunction<T, V> {
    return new ComposableFunction((data: T) => fn.execute(this.fn(data)));
  }
}

export class AsyncComposableFunction<T, U> {
  constructor(private fn: (data: T) => Promise<U>) {}

  map<V>(fn: (data: U) => Promise<V>): AsyncComposableFunction<T, V> {
    return new AsyncComposableFunction(async (data: T) => {
      const result = await this.fn(data);
      return fn(result);
    });
  }

  flatMap<V>(fn: (data: U) => AsyncComposableFunction<T, V>): AsyncComposableFunction<T, V> {
    return new AsyncComposableFunction(async (data: T) => {
      const result = await this.fn(data);
      return fn(result).execute(data);
    });
  }

  filter(predicate: (data: U) => boolean | Promise<boolean>): AsyncComposableFunction<T, U | null> {
    return new AsyncComposableFunction(async (data: T) => {
      const result = await this.fn(data);
      const shouldInclude = await predicate(result);
      return shouldInclude ? result : null;
    });
  }

  async execute(data: T): Promise<U> {
    return this.fn(data);
  }

  compose<V>(fn: AsyncComposableFunction<U, V>): AsyncComposableFunction<T, V> {
    return new AsyncComposableFunction(async (data: T) => {
      const result = await this.fn(data);
      return fn.execute(result);
    });
  }
}

export function createMiddleware<T, U>(fn: (data: T) => Promise<U>): Middleware<T, U> {
  return { process: fn };
}

export function createAsyncPipeline<T>(
  stages: Array<(data: any) => Promise<any>>,
): AsyncComposableFunction<T, any> {
  let pipeline = new AsyncComposableFunction<T, any>((data) => Promise.resolve(data));

  for (const stage of stages) {
    pipeline = pipeline.map(stage);
  }

  return pipeline;
}

export function composeAsync<T, U, V>(
  f: (x: T) => Promise<U>,
  g: (x: U) => Promise<V>,
): (x: T) => Promise<V> {
  return async (x: T) => g(await f(x));
}

export function composeSync<T, U, V>(f: (x: T) => U, g: (x: U) => V): (x: T) => V {
  return (x: T) => g(f(x));
}
