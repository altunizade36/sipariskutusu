export type LanguageCode = 'tr' | 'en';

export interface Translation {
  [key: string]: string | Translation;
}

export class LocalizationService {
  private static currentLanguage: LanguageCode = 'tr';
  private static translations: Map<LanguageCode, Translation> = new Map();
  private static listeners: Array<() => void> = [];

  static setLanguage(language: LanguageCode): void {
    this.currentLanguage = language;
    this.notifyListeners();
  }

  static getLanguage(): LanguageCode {
    return this.currentLanguage;
  }

  static registerTranslations(language: LanguageCode, translations: Translation): void {
    this.translations.set(language, translations);
  }

  static t(key: string, defaultValue?: string): string {
    const keys = key.split('.');
    let value: any = this.translations.get(this.currentLanguage) || {};

    for (const k of keys) {
      value = value?.[k];
    }

    if (typeof value === 'string') {
      return value;
    }

    return defaultValue || key;
  }

  static interpolate(template: string, values: Record<string, string | number>): string {
    let result = template;

    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }

    return result;
  }

  static subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export class TextProcessingService {
  static capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  static capitalizeWords(text: string): string {
    return text
      .split(' ')
      .map((word) => this.capitalize(word))
      .join(' ');
  }

  static truncate(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  static removeDiacritics(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  static toSlug(text: string, separator: string = '-'): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, separator)
      .replace(/[^\w-]/g, '')
      .replace(new RegExp(`${separator}+`, 'g'), separator)
      .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '');
  }

  static toTurkishSlug(text: string, separator: string = '-'): string {
    const turkishMap: Record<string, string> = {
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

    let result = text;
    for (const [turkish, english] of Object.entries(turkishMap)) {
      result = result.replace(new RegExp(turkish, 'g'), english);
    }

    return this.toSlug(result, separator);
  }

  static countWords(text: string): number {
    return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
  }

  static splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }

    return chunks;
  }

  static extractUrls(text: string): string[] {
    const urlRegex =
      /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/g;
    return text.match(urlRegex) || [];
  }

  static extractEmails(text: string): string[] {
    const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
    return text.match(emailRegex) || [];
  }

  static extractHashtags(text: string): string[] {
    const hashtagRegex = /#\w+/g;
    return text.match(hashtagRegex) || [];
  }

  static highlightSearchTerm(text: string, searchTerm: string, tag: string = 'mark'): string {
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, `<${tag}>$1</${tag}>`);
  }

  static stripHtml(html: string): string {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  static repeat(text: string, count: number, separator: string = ''): string {
    return new Array(count).fill(text).join(separator);
  }

  static reverse(text: string): string {
    return text.split('').reverse().join('');
  }

  static isPalindrome(text: string): boolean {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleaned === this.reverse(cleaned);
  }

  static levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator,
        );
      }
    }

    return matrix[len2][len1];
  }

  static similarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }
}
