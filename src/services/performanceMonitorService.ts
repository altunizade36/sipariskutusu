import { AppState, Platform } from 'react-native';

export interface MemoryInfo {
  used: number;
  total: number;
  threshold: number;
  warning: boolean;
  critical: boolean;
}

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor {
  private static metrics: Map<string, PerformanceMetric[]> = new Map();
  private static timers: Map<string, number> = new Map();
  private static maxMetricsPerName = 100;
  private static warningThreshold = 0.85; // 85% memory
  private static criticalThreshold = 0.95; // 95% memory

  static startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  static endTimer(name: string, metadata?: Record<string, any>): PerformanceMetric | null {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`Timer "${name}" was not started`);
      return null;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricsArray = this.metrics.get(name)!;
    metricsArray.push(metric);

    // Keep only recent metrics
    if (metricsArray.length > this.maxMetricsPerName) {
      metricsArray.shift();
    }

    return metric;
  }

  static async measure<T>(
    name: string,
    fn: () => Promise<T> | T,
    metadata?: Record<string, any>,
  ): Promise<T> {
    this.startTimer(name);
    try {
      const result = await Promise.resolve(fn());
      this.endTimer(name, metadata);
      return result;
    } catch (error) {
      this.endTimer(name, { ...metadata, error: true });
      throw error;
    }
  }

  static getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.get(name) || [];
    }

    const all: PerformanceMetric[] = [];
    for (const metrics of this.metrics.values()) {
      all.push(...metrics);
    }
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  static getMetricStats(name: string) {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) {
      return null;
    }

    const durations = metrics.map((m) => m.duration);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    return {
      count: metrics.length,
      avg,
      min,
      max,
      total: sum,
      lastDuration: metrics[metrics.length - 1].duration,
    };
  }

  static getAllStats() {
    const stats: Record<string, any> = {};

    for (const [name] of this.metrics) {
      stats[name] = this.getMetricStats(name);
    }

    return stats;
  }

  static clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }

  static getMemoryInfo(): MemoryInfo {
    // Note: Actual memory info requires native modules
    // This is a simplified simulation
    const used = Math.random() * 100; // Simulated percentage
    const total = 100;
    const threshold = used / total;

    return {
      used: Math.round(used),
      total,
      threshold,
      warning: threshold >= this.warningThreshold,
      critical: threshold >= this.criticalThreshold,
    };
  }

  static logMemoryWarnings(): void {
    const memory = this.getMemoryInfo();

    if (memory.critical) {
      console.warn(`🔴 CRITICAL MEMORY: ${memory.used}/${memory.total}%`);
    } else if (memory.warning) {
      console.warn(`🟡 WARNING MEMORY: ${memory.used}/${memory.total}%`);
    }
  }

  static getAppStateMetrics() {
    return {
      platform: Platform.OS,
      environment: __DEV__ ? 'development' : 'production',
      timestamp: Date.now(),
    };
  }

  static getReport(): {
    timestamp: number;
    metrics: Record<string, any>;
    memory: MemoryInfo;
    appState: Record<string, any>;
  } {
    return {
      timestamp: Date.now(),
      metrics: this.getAllStats(),
      memory: this.getMemoryInfo(),
      appState: this.getAppStateMetrics(),
    };
  }

  static exportReport(): string {
    return JSON.stringify(this.getReport(), null, 2);
  }
}

export class RenderMonitor {
  private static renderCounts: Map<string, number> = new Map();
  private static lastRenderTimes: Map<string, number> = new Map();

  static recordRender(componentName: string): void {
    const count = (this.renderCounts.get(componentName) || 0) + 1;
    this.renderCounts.set(componentName, count);
    this.lastRenderTimes.set(componentName, Date.now());
  }

  static getRenderCount(componentName: string): number {
    return this.renderCounts.get(componentName) || 0;
  }

  static getLastRenderTime(componentName: string): number | null {
    return this.lastRenderTimes.get(componentName) || null;
  }

  static getAllRenderCounts(): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const [name, count] of this.renderCounts) {
      counts[name] = count;
    }

    return counts;
  }

  static clearRenderCounts(): void {
    this.renderCounts.clear();
    this.lastRenderTimes.clear();
  }

  static getMostRenderedComponents(limit: number = 10): Array<{
    name: string;
    count: number;
    lastRender: number | null;
  }> {
    const entries = Array.from(this.renderCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        lastRender: this.lastRenderTimes.get(name) || null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return entries;
  }
}
