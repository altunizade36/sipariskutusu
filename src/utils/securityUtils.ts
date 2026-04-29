import * as Crypto from 'expo-crypto';

export class SecurityUtils {
  static async hashPassword(password: string): Promise<string> {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const hashedPassword = await this.hashPassword(password);
    return hashedPassword === hash;
  }

  static generateSecureToken(length: number = 32): string {
    const randomBytes = Crypto.getRandomBytes(length);
    return Array.from(randomBytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  static generateOTP(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    const randomBytes = Crypto.getRandomBytes(length);

    for (let i = 0; i < length; i++) {
      otp += digits[randomBytes[i] % 10];
    }

    return otp;
  }

  static async hashData(data: string, algorithm: string = 'SHA256'): Promise<string> {
    const algo = algorithm.toUpperCase() as Crypto.CryptoDigestAlgorithm;
    return Crypto.digestStringAsync(algo, data);
  }

  static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .slice(0, 1000); // Limit length
  }

  static escapeHTML(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePhoneNumber(phone: string): boolean {
    const turkishPhoneRegex = /^(\+90|0)?[1-9]\d{9}$/;
    return turkishPhoneRegex.test(phone.replace(/[\s-()]/g, ''));
  }

  static validatePassword(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Şifre en az 8 karakter olmalıdır');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Şifre en az bir büyük harf içermelidir');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Şifre en az bir küçük harf içermelidir');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Şifre en az bir rakam içermelidir');
    }

    if (!/[!@#$%^&*]/.test(password)) {
      errors.push('Şifre en az bir özel karakter içermelidir');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static getMaskingPattern(type: 'email' | 'phone' | 'creditCard'): string {
    const patterns: Record<string, string> = {
      email: '****@****',
      phone: '****-****-****',
      creditCard: '****-****-****-****',
    };

    return patterns[type];
  }

  static maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    const maskedLocal = localPart.substring(0, 2) + '****' + localPart.substring(localPart.length - 1);
    return `${maskedLocal}@${domain}`;
  }

  static maskPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.substring(0, 3) + '****' + cleaned.substring(cleaned.length - 3);
  }

  static maskCreditCard(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\D/g, '');
    return '****-****-****-' + cleaned.substring(cleaned.length - 4);
  }
}

export class SessionSecurityUtils {
  private static sessionTokens: Map<string, { token: string; expiresAt: number }> = new Map();
  private static sessionTimeout = 30 * 60 * 1000; // 30 minutes

  static createSession(userId: string): string {
    const token = SecurityUtils.generateSecureToken();
    const expiresAt = Date.now() + this.sessionTimeout;

    this.sessionTokens.set(userId, { token, expiresAt });
    return token;
  }

  static validateSession(userId: string, token: string): boolean {
    const session = this.sessionTokens.get(userId);

    if (!session) return false;
    if (session.token !== token) return false;
    if (Date.now() > session.expiresAt) {
      this.sessionTokens.delete(userId);
      return false;
    }

    return true;
  }

  static extendSession(userId: string): boolean {
    const session = this.sessionTokens.get(userId);

    if (!session) return false;

    session.expiresAt = Date.now() + this.sessionTimeout;
    return true;
  }

  static destroySession(userId: string): void {
    this.sessionTokens.delete(userId);
  }

  static getSessionExpiresAt(userId: string): number | null {
    const session = this.sessionTokens.get(userId);
    return session?.expiresAt || null;
  }

  static isSessionExpiring(userId: string, withinMs: number = 5 * 60 * 1000): boolean {
    const expiresAt = this.getSessionExpiresAt(userId);
    if (!expiresAt) return false;

    const timeUntilExpiry = expiresAt - Date.now();
    return timeUntilExpiry <= withinMs;
  }
}
