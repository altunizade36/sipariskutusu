import { Logger } from './loggerService';
import { RetryManager } from './retryManagerService';
import { RateLimiter } from './rateLimiterService';

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retryConfig?: any;
  skipRateLimit?: boolean;
}

export interface RequestResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
  headers?: Record<string, string>;
}

export class RequestManager {
  private static defaultTimeout = 30000;
  private static baseURL = '';
  private static authToken?: string;
  private static interceptors: {
    request: Array<(config: RequestConfig) => RequestConfig>;
    response: Array<(response: RequestResponse) => RequestResponse>;
    error: Array<(error: Error) => void>;
  } = {
    request: [],
    response: [],
    error: [],
  };

  static setBaseURL(url: string) {
    this.baseURL = url;
  }

  static setAuthToken(token: string) {
    this.authToken = token;
  }

  static clearAuthToken() {
    this.authToken = undefined;
  }

  static addRequestInterceptor(interceptor: (config: RequestConfig) => RequestConfig) {
    this.interceptors.request.push(interceptor);
  }

  static addResponseInterceptor(interceptor: (response: RequestResponse) => RequestResponse) {
    this.interceptors.response.push(interceptor);
  }

  static addErrorInterceptor(interceptor: (error: Error) => void) {
    this.interceptors.error.push(interceptor);
  }

  static async request<T = any>(config: RequestConfig): Promise<RequestResponse<T>> {
    try {
      // Apply request interceptors
      let finalConfig = { ...config };
      for (const interceptor of this.interceptors.request) {
        finalConfig = interceptor(finalConfig);
      }

      // Check rate limit
      if (!finalConfig.skipRateLimit) {
        const rateLimitStatus = await RateLimiter.checkLimit(finalConfig.url);
        if (rateLimitStatus.isLimited) {
          Logger.warn('Rate limit exceeded', { url: finalConfig.url });
          return {
            success: false,
            error: 'Rate limit exceeded',
            status: 429,
          };
        }
      }

      // Execute with retry
      const response = await RetryManager.executeWithRetry(
        async () => this.executeRequest(finalConfig),
        finalConfig.retryConfig,
      );

      // Record successful request
      await RateLimiter.recordRequest(finalConfig.url);

      // Apply response interceptors
      let finalResponse = response;
      for (const interceptor of this.interceptors.response) {
        finalResponse = interceptor(finalResponse);
      }

      Logger.info('Request successful', { url: finalConfig.url, status: response.status });
      return finalResponse;
    } catch (error) {
      Logger.error('Request failed', { url: config.url }, error as Error);

      for (const interceptor of this.interceptors.error) {
        interceptor(error as Error);
      }

      return {
        success: false,
        error: (error as Error).message,
        status: 0,
      };
    }
  }

  private static async executeRequest<T = any>(config: RequestConfig): Promise<RequestResponse<T>> {
    const url = config.url.startsWith('http') ? config.url : `${this.baseURL}${config.url}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || this.defaultTimeout);

    try {
      const response = await fetch(url, {
        method: config.method,
        headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const text = await response.text();
      let data;

      try {
        data = text ? JSON.parse(text) : undefined;
      } catch {
        data = text;
      }

      return {
        success: response.ok,
        data: data as T,
        status: response.status,
        headers: responseHeaders,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async get<T = any>(url: string, config?: Partial<RequestConfig>): Promise<RequestResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      ...config,
    });
  }

  static async post<T = any>(url: string, body?: any, config?: Partial<RequestConfig>): Promise<RequestResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      body,
      ...config,
    });
  }

  static async put<T = any>(url: string, body?: any, config?: Partial<RequestConfig>): Promise<RequestResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      body,
      ...config,
    });
  }

  static async delete<T = any>(url: string, config?: Partial<RequestConfig>): Promise<RequestResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
      ...config,
    });
  }

  static async patch<T = any>(url: string, body?: any, config?: Partial<RequestConfig>): Promise<RequestResponse<T>> {
    return this.request<T>({
      method: 'PATCH',
      url,
      body,
      ...config,
    });
  }
}
