export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  data?: any;
  stack?: string;
}

const LOG_COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m', // Green
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
};

export class Logger {
  private static logs: LogEntry[] = [];
  private static maxLogs = 500;
  private static isDevelopment = __DEV__;

  static debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  static info(message: string, data?: any) {
    this.log('info', message, data);
  }

  static warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  static error(message: string, data?: any, error?: Error) {
    this.log('error', message, data, error?.stack);
  }

  private static log(level: LogLevel, message: string, data?: any, stack?: string) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      data,
      stack,
    };

    this.logs.push(entry);

    // Keep only latest logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    if (this.isDevelopment) {
      this.printLog(entry);
    }
  }

  private static printLog(entry: LogEntry) {
    const color = LOG_COLORS[entry.level] as string;
    const reset = '\x1b[0m';
    const time = new Date(entry.timestamp).toLocaleTimeString('tr-TR');

    console.log(
      `${color}[${entry.level.toUpperCase()}]${reset} ${time} - ${entry.message}`,
      entry.data || '',
    );

    if (entry.stack) {
      console.log(entry.stack);
    }
  }

  static getLogs(level?: LogLevel): LogEntry[] {
    if (!level) return this.logs;
    return this.logs.filter((log) => log.level === level);
  }

  static getRecentLogs(count = 20): LogEntry[] {
    return this.logs.slice(-count);
  }

  static clear() {
    this.logs = [];
  }

  static export(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  static async sendToServer(endpoint: string): Promise<boolean> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: this.logs,
          timestamp: Date.now(),
          appVersion: '1.0.0', // Replace with actual version
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send logs to server:', error);
      return false;
    }
  }
}
