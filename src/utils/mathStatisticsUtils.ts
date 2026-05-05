export class MathUtils {
  static add(a: number, b: number): number {
    return a + b;
  }

  static subtract(a: number, b: number): number {
    return a - b;
  }

  static multiply(a: number, b: number): number {
    return a * b;
  }

  static divide(a: number, b: number, precision?: number): number {
    if (b === 0) {
      throw new Error('Division by zero');
    }

    const result = a / b;
    return precision !== undefined ? Math.round(result * Math.pow(10, precision)) / Math.pow(10, precision) : result;
  }

  static modulo(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Modulo by zero');
    }

    return a % b;
  }

  static power(base: number, exponent: number): number {
    return Math.pow(base, exponent);
  }

  static square(a: number): number {
    return a * a;
  }

  static sqrt(a: number): number {
    return Math.sqrt(a);
  }

  static abs(a: number): number {
    return Math.abs(a);
  }

  static ceil(a: number): number {
    return Math.ceil(a);
  }

  static floor(a: number): number {
    return Math.floor(a);
  }

  static round(a: number, precision: number = 0): number {
    const multiplier = Math.pow(10, precision);
    return Math.round(a * multiplier) / multiplier;
  }

  static min(...numbers: number[]): number {
    return Math.min(...numbers);
  }

  static max(...numbers: number[]): number {
    return Math.max(...numbers);
  }

  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  static isEven(n: number): boolean {
    return n % 2 === 0;
  }

  static isOdd(n: number): boolean {
    return n % 2 !== 0;
  }

  static isPrime(n: number): boolean {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;

    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) {
        return false;
      }
    }

    return true;
  }

  static factorial(n: number): number {
    if (n < 0) throw new Error('Factorial of negative number');
    if (n === 0 || n === 1) return 1;

    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }

    return result;
  }

  static gcd(a: number, b: number): number {
    return b === 0 ? a : this.gcd(b, a % b);
  }

  static lcm(a: number, b: number): number {
    return Math.abs(a * b) / this.gcd(a, b);
  }

  static toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  static toDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
  }

  static sine(angle: number): number {
    return Math.sin(this.toRadians(angle));
  }

  static cosine(angle: number): number {
    return Math.cos(this.toRadians(angle));
  }

  static tangent(angle: number): number {
    return Math.tan(this.toRadians(angle));
  }

  static arcsin(value: number): number {
    return this.toDegrees(Math.asin(value));
  }

  static arccos(value: number): number {
    return this.toDegrees(Math.acos(value));
  }

  static arctan(value: number): number {
    return this.toDegrees(Math.atan(value));
  }

  static log(value: number, base: number = Math.E): number {
    return Math.log(value) / Math.log(base);
  }

  static exponential(value: number): number {
    return Math.exp(value);
  }

  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static randomFloat(min: number, max: number, precision: number = 2): number {
    return parseFloat((Math.random() * (max - min) + min).toFixed(precision));
  }

  static percentage(value: number, total: number): number {
    return this.round((value / total) * 100, 2);
  }

  static discountPrice(originalPrice: number, discountPercent: number): number {
    return this.round(originalPrice * (1 - discountPercent / 100), 2);
  }

  static markupPrice(cost: number, markupPercent: number): number {
    return this.round(cost * (1 + markupPercent / 100), 2);
  }
}

export class StatisticsUtils {
  static mean(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  static median(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  static mode(numbers: number[]): number[] {
    const frequency = new Map<number, number>();

    numbers.forEach((n) => {
      frequency.set(n, (frequency.get(n) || 0) + 1);
    });

    const maxFreq = Math.max(...frequency.values());
    return [...frequency.keys()].filter((n) => frequency.get(n) === maxFreq);
  }

  static range(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return Math.max(...numbers) - Math.min(...numbers);
  }

  static variance(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const avg = this.mean(numbers);
    const squareDiffs = numbers.map((n) => Math.pow(n - avg, 2));
    return squareDiffs.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  static standardDeviation(numbers: number[]): number {
    return Math.sqrt(this.variance(numbers));
  }

  static quartile(numbers: number[], q: 1 | 2 | 3): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = (sorted.length * q) / 4;

    if (index % 1 === 0) {
      return sorted[index - 1];
    }

    const lower = sorted[Math.floor(index) - 1];
    const upper = sorted[Math.ceil(index) - 1];
    return lower + (upper - lower) * (index % 1);
  }

  static interquartileRange(numbers: number[]): number {
    return this.quartile(numbers, 3) - this.quartile(numbers, 1);
  }

  static outliers(numbers: number[], threshold: number = 1.5): number[] {
    const q1 = this.quartile(numbers, 1);
    const q3 = this.quartile(numbers, 3);
    const iqr = q3 - q1;

    const lowerBound = q1 - threshold * iqr;
    const upperBound = q3 + threshold * iqr;

    return numbers.filter((n) => n < lowerBound || n > upperBound);
  }

  static skewness(numbers: number[]): number {
    const n = numbers.length;
    const mean = this.mean(numbers);
    const std = this.standardDeviation(numbers);

    if (std === 0) return 0;

    const skew = numbers.reduce((sum, x) => sum + Math.pow((x - mean) / std, 3), 0) / n;
    return skew;
  }

  static kurtosis(numbers: number[]): number {
    const n = numbers.length;
    const mean = this.mean(numbers);
    const std = this.standardDeviation(numbers);

    if (std === 0) return 0;

    const kurt = numbers.reduce((sum, x) => sum + Math.pow((x - mean) / std, 4), 0) / n;
    return kurt - 3;
  }

  static covariance(x: number[], y: number[]): number {
    if (x.length !== y.length) throw new Error('Arrays must have same length');

    const meanX = this.mean(x);
    const meanY = this.mean(y);

    return (
      x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0) / x.length
    );
  }

  static correlation(x: number[], y: number[]): number {
    if (x.length !== y.length) throw new Error('Arrays must have same length');

    const cov = this.covariance(x, y);
    const stdX = this.standardDeviation(x);
    const stdY = this.standardDeviation(y);

    if (stdX === 0 || stdY === 0) return 0;

    return cov / (stdX * stdY);
  }
}
