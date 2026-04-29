export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export class Validator {
  static isEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isPhoneNumber(phone: string): boolean {
    // Turkish phone format
    const turkishPhoneRegex = /^(\+90|0)?[1-9]\d{9}$/;
    return turkishPhoneRegex.test(phone.replace(/[\s-()]/g, ''));
  }

  static isURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isStrongPassword(password: string): boolean {
    // At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
  }

  static isNotEmpty(value: string): boolean {
    return value.trim().length > 0;
  }

  static minLength(value: string, length: number): boolean {
    return value.length >= length;
  }

  static maxLength(value: string, length: number): boolean {
    return value.length <= length;
  }

  static isNumber(value: string): boolean {
    return !isNaN(Number(value)) && value.trim() !== '';
  }

  static isPositiveNumber(value: string): boolean {
    return this.isNumber(value) && Number(value) > 0;
  }

  static matches(value: string, pattern: RegExp): boolean {
    return pattern.test(value);
  }

  static validateEmail(email: string): ValidationError | null {
    if (!this.isNotEmpty(email)) {
      return { field: 'email', message: 'E-posta gereklidir' };
    }
    if (!this.isEmail(email)) {
      return { field: 'email', message: 'Geçerli bir e-posta giriniz' };
    }
    return null;
  }

  static validatePassword(password: string): ValidationError | null {
    if (!this.isNotEmpty(password)) {
      return { field: 'password', message: 'Şifre gereklidir' };
    }
    if (!this.minLength(password, 8)) {
      return { field: 'password', message: 'Şifre en az 8 karakter olmalıdır' };
    }
    return null;
  }

  static validatePhoneNumber(phone: string): ValidationError | null {
    if (!this.isNotEmpty(phone)) {
      return { field: 'phone', message: 'Telefon numarası gereklidir' };
    }
    if (!this.isPhoneNumber(phone)) {
      return { field: 'phone', message: 'Geçerli bir telefon numarası giriniz' };
    }
    return null;
  }

  static validateRequired(value: any, fieldName: string): ValidationError | null {
    if (value === null || value === undefined || value === '') {
      return { field: fieldName, message: `${fieldName} gereklidir` };
    }
    return null;
  }

  static validateForm(data: Record<string, any>, rules: Record<string, (val: any) => ValidationError | null>): ValidationResult {
    const errors: ValidationError[] = [];

    Object.entries(rules).forEach(([field, validator]) => {
      const error = validator(data[field]);
      if (error) {
        errors.push(error);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export class Turkish {
  static slugify(text: string): string {
    const turkishCharMap: Record<string, string> = {
      ç: 'c',
      ğ: 'g',
      ı: 'i',
      ö: 'o',
      ş: 's',
      ü: 'u',
      Ç: 'C',
      Ğ: 'G',
      İ: 'I',
      Ö: 'O',
      Ş: 'S',
      Ü: 'U',
    };

    let slug = text.toLowerCase();
    Object.entries(turkishCharMap).forEach(([char, replacement]) => {
      slug = slug.replace(new RegExp(char, 'g'), replacement);
    });

    return slug
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .replace(/^-+|-+$/g, '');
  }

  static capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }
}
