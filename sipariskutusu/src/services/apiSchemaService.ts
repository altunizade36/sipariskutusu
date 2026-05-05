export type ValidationType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date';

export interface ValidationRule {
  type: ValidationType;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
}

export interface SchemaDefinition {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

export class SchemaValidator {
  static validate(data: any, schema: SchemaDefinition): ValidationResult {
    const errors: Record<string, string[]> = {};

    for (const [key, rule] of Object.entries(schema)) {
      const value = data[key];
      const fieldErrors = this.validateField(key, value, rule);

      if (fieldErrors.length > 0) {
        errors[key] = fieldErrors;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  private static validateField(key: string, value: any, rule: ValidationRule): string[] {
    const errors: string[] = [];

    // Check required
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${key} is required`);
      return errors;
    }

    if (value === undefined || value === null) {
      return errors;
    }

    // Check type
    if (!this.checkType(value, rule.type)) {
      errors.push(`${key} must be of type ${rule.type}`);
      return errors;
    }

    // Check min/max
    if (rule.type === 'string') {
      if (rule.min !== undefined && value.length < rule.min) {
        errors.push(`${key} must be at least ${rule.min} characters`);
      }

      if (rule.max !== undefined && value.length > rule.max) {
        errors.push(`${key} must be at most ${rule.max} characters`);
      }

      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${key} does not match required pattern`);
      }
    }

    if (rule.type === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`${key} must be at least ${rule.min}`);
      }

      if (rule.max !== undefined && value > rule.max) {
        errors.push(`${key} must be at most ${rule.max}`);
      }
    }

    if (rule.type === 'array') {
      if (rule.min !== undefined && value.length < rule.min) {
        errors.push(`${key} must have at least ${rule.min} items`);
      }

      if (rule.max !== undefined && value.length > rule.max) {
        errors.push(`${key} must have at most ${rule.max} items`);
      }
    }

    // Check enum
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`${key} must be one of: ${rule.enum.join(', ')}`);
    }

    // Check custom
    if (rule.custom) {
      const customResult = rule.custom(value);

      if (customResult === false) {
        errors.push(`${key} failed custom validation`);
      } else if (typeof customResult === 'string') {
        errors.push(customResult);
      }
    }

    return errors;
  }

  private static checkType(value: any, type: ValidationType): boolean {
    if (type === 'string') return typeof value === 'string';
    if (type === 'number') return typeof value === 'number';
    if (type === 'boolean') return typeof value === 'boolean';
    if (type === 'object') return typeof value === 'object' && !Array.isArray(value);
    if (type === 'array') return Array.isArray(value);
    if (type === 'date') return value instanceof Date || typeof value === 'number';

    return false;
  }
}

export class APIRequestBuilder {
  private method: string = 'GET';
  private url: string = '';
  private headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  private body: any = null;
  private params: Record<string, string> = {};

  setMethod(method: string): this {
    this.method = method;
    return this;
  }

  setUrl(url: string): this {
    this.url = url;
    return this;
  }

  setHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  setBody(body: any): this {
    this.body = body;
    return this;
  }

  setParam(key: string, value: string): this {
    this.params[key] = value;
    return this;
  }

  setParams(params: Record<string, string>): this {
    this.params = { ...this.params, ...params };
    return this;
  }

  build() {
    const params = new URLSearchParams(this.params);
    const queryString = params.toString();
    const finalUrl = queryString ? `${this.url}?${queryString}` : this.url;

    return {
      method: this.method,
      url: finalUrl,
      headers: this.headers,
      body: this.body ? JSON.stringify(this.body) : undefined,
    };
  }
}

export class ResponseParser {
  static async parse<T>(response: Response): Promise<{ data: T; status: number }> {
    const status = response.status;

    if (!response.ok) {
      throw new Error(`HTTP ${status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      const data = (await response.json()) as T;
      return { data, status };
    }

    const text = await response.text();
    return { data: text as T, status };
  }

  static async parseError(response: Response): Promise<{
    message: string;
    code?: string;
    details?: any;
  }> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      try {
        const error = await response.json();
        return {
          message: error.message || error.error || 'Unknown error',
          code: error.code,
          details: error.details,
        };
      } catch {
        return { message: response.statusText };
      }
    }

    const text = await response.text();
    return { message: text };
  }
}
