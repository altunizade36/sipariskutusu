export class ArrayUtils {
  static chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  static flatten<T>(arr: any[]): T[] {
    return arr.reduce((flat: T[], item) => {
      if (Array.isArray(item)) {
        flat.push(...item);
      } else {
        flat.push(item);
      }
      return flat;
    }, [] as T[]);
  }

  static unique<T>(arr: T[], key?: (item: T) => any): T[] {
    if (!key) {
      return [...new Set(arr)];
    }

    const seen = new Set();
    return arr.filter((item) => {
      const k = key(item);
      if (seen.has(k)) {
        return false;
      }
      seen.add(k);
      return true;
    });
  }

  static removeDuplicates<T>(arr: T[]): T[] {
    return this.unique(arr);
  }

  static groupBy<T, K extends string | number>(
    arr: T[],
    key: (item: T) => K,
  ): Record<K, T[]> {
    return arr.reduce(
      (groups, item) => {
        const k = key(item);
        if (!groups[k]) {
          groups[k] = [];
        }
        groups[k].push(item);
        return groups;
      },
      {} as Record<K, T[]>,
    );
  }

  static sortBy<T>(arr: T[], key: (item: T) => any, direction: 'asc' | 'desc' = 'asc'): T[] {
    const sorted = [...arr].sort((a, b) => {
      const aVal = key(a);
      const bVal = key(b);

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  static maxBy<T>(arr: T[], key: (item: T) => number): T | undefined {
    return arr.reduce((max, item) => {
      const val = key(item);
      const maxVal = key(max);
      return val > maxVal ? item : max;
    });
  }

  static minBy<T>(arr: T[], key: (item: T) => number): T | undefined {
    return arr.reduce((min, item) => {
      const val = key(item);
      const minVal = key(min);
      return val < minVal ? item : min;
    });
  }

  static sum(arr: number[]): number {
    return arr.reduce((sum, val) => sum + val, 0);
  }

  static average(arr: number[]): number {
    return this.sum(arr) / arr.length || 0;
  }

  static range(start: number, end: number, step: number = 1): number[] {
    const result: number[] = [];
    for (let i = start; i <= end; i += step) {
      result.push(i);
    }
    return result;
  }

  static shuffle<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static sample<T>(arr: T[], size: number = 1): T[] {
    const shuffled = this.shuffle(arr);
    return shuffled.slice(0, size);
  }

  static difference<T>(arr1: T[], arr2: T[]): T[] {
    return arr1.filter((item) => !arr2.includes(item));
  }

  static intersection<T>(arr1: T[], arr2: T[]): T[] {
    return arr1.filter((item) => arr2.includes(item));
  }

  static union<T>(arr1: T[], arr2: T[]): T[] {
    return this.unique([...arr1, ...arr2]);
  }

  static compact<T>(arr: (T | null | undefined | false)[]): T[] {
    return arr.filter((item) => !!item) as T[];
  }

  static fill<T>(value: T, length: number): T[] {
    return new Array(length).fill(value);
  }

  static zipWith<T1, T2>(arr1: T1[], arr2: T2[]): Array<[T1, T2]> {
    const length = Math.min(arr1.length, arr2.length);
    return Array.from({ length }, (_, i) => [arr1[i], arr2[i]]);
  }

  static transpose<T>(matrix: T[][]): T[][] {
    if (matrix.length === 0) return [];
    return Array.from({ length: matrix[0].length }, (_, colIndex) =>
      matrix.map((row) => row[colIndex]),
    );
  }

  static partition<T>(arr: T[], predicate: (item: T) => boolean): [T[], T[]] {
    const pass: T[] = [];
    const fail: T[] = [];

    arr.forEach((item) => {
      if (predicate(item)) {
        pass.push(item);
      } else {
        fail.push(item);
      }
    });

    return [pass, fail];
  }

  static findIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
    for (let i = 0; i < arr.length; i++) {
      if (predicate(arr[i])) {
        return i;
      }
    }
    return -1;
  }
}

export class ObjectUtils {
  static keys<T extends object>(obj: T): (keyof T)[] {
    return Object.keys(obj) as (keyof T)[];
  }

  static values<T extends object>(obj: T): T[keyof T][] {
    return Object.values(obj);
  }

  static entries<T extends object>(obj: T): [keyof T, T[keyof T]][] {
    return Object.entries(obj) as [keyof T, T[keyof T]][];
  }

  static pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    keys.forEach((key) => {
      result[key] = obj[key];
    });
    return result;
  }

  static omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj };
    keys.forEach((key) => {
      delete result[key];
    });
    return result;
  }

  static merge<T extends object, U extends object>(obj1: T, obj2: U): T & U {
    return { ...obj1, ...obj2 } as T & U;
  }

  static deepMerge<T extends object>(obj1: T, obj2: Partial<T>): T {
    const result = { ...obj1 };

    for (const [key, value] of Object.entries(obj2)) {
      if (value !== undefined) {
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          typeof result[key] === 'object' &&
          result[key] !== null &&
          !Array.isArray(result[key])
        ) {
          result[key] = this.deepMerge(result[key] as T, value as Partial<T>);
        } else {
          result[key] = value as any;
        }
      }
    }

    return result;
  }

  static isEmpty(obj: object): boolean {
    return Object.keys(obj).length === 0;
  }

  static hasKey<T extends object>(obj: T, key: PropertyKey): boolean {
    return key in obj;
  }

  static invert<T extends Record<string, string>>(obj: T): Record<T[keyof T], string> {
    const result = {} as Record<T[keyof T], string>;
    for (const [key, value] of Object.entries(obj)) {
      result[value as T[keyof T]] = key;
    }
    return result;
  }

  static mapValues<T extends object, U>(obj: T, fn: (value: T[keyof T]) => U): Record<keyof T, U> {
    const result = {} as Record<keyof T, U>;
    for (const [key, value] of Object.entries(obj)) {
      result[key as keyof T] = fn(value);
    }
    return result;
  }

  static filterValues<T extends object>(obj: T, predicate: (value: T[keyof T]) => boolean): Partial<T> {
    const result = {} as Partial<T>;
    for (const [key, value] of Object.entries(obj)) {
      if (predicate(value)) {
        result[key as keyof T] = value as T[keyof T];
      }
    }
    return result;
  }

  static clone<T extends object>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  static deepClone<T extends object>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as any;
    if (obj instanceof Array) return obj.map((item) => this.deepClone(item)) as any;
    if (obj instanceof Object) {
      const clonedObj = {} as T;
      for (const key in obj) {
        const value = obj[key];
        if (value !== null && typeof value === 'object') {
          clonedObj[key] = this.deepClone(value as any);
        } else {
          clonedObj[key] = value as any;
        }
      }
      return clonedObj;
    }
    return obj;
  }

  static toCamelCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
      result[camelKey] = typeof value === 'object' ? this.toCamelCase(value) : value;
    }

    return result;
  }

  static toSnakeCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
      result[snakeKey] = typeof value === 'object' ? this.toSnakeCase(value) : value;
    }

    return result;
  }

  static equal<T extends object>(obj1: T, obj2: T): boolean {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  static size(obj: object): number {
    return Object.keys(obj).length;
  }
}
