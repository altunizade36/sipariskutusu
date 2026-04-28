/*
  Release gate runner for performance module.
  Steps:
  1) build:performance
  2) load:gate
  3) collect runtime metrics snapshots from API

  Example:
  node scripts/release-gate.mjs --base-url http://localhost:4100
*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value ?? fallback;
}

function run(command, args, label, options = { capture: false }) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? 'pipe' : 'inherit',
    shell: true,
    encoding: options.capture ? 'utf8' : undefined,
  });

  if (options.capture) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed`);
  }

  return options.capture ? String(result.stdout ?? '') : '';
}

function parseKeyValueLines(output) {
  const parsed = {};
  for (const line of output.split(/\r?\n/)) {
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    parsed[key] = value;
  }
  return parsed;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`);
  }
  return response.json();
}

async function main() {
  const baseUrl = getArg('--base-url', 'http://localhost:4100');
  const requireRedisHealth = (process.env.REQUIRE_REDIS_HEALTH ?? 'true').toLowerCase() === 'true';
  const maxCacheErrorMetric = Number(process.env.RELEASE_MAX_CACHE_ERROR_METRIC ?? '0');
  const maxRateLimitErrorMetric = Number(process.env.RELEASE_MAX_RATE_LIMIT_ERROR_METRIC ?? '0');
  const maxFallbackEmergencyMetric = Number(process.env.RELEASE_MAX_RATE_LIMIT_FALLBACK_EMERGENCY ?? '0');
  const maxBanBlockedMetric = Number(process.env.RELEASE_MAX_BAN_BLOCKED_METRIC ?? '1000000');
  const maxSessionEvictedMetric = Number(process.env.RELEASE_MAX_SESSION_EVICTED_METRIC ?? '1000000');

  const loadArgs = [];
  const loadForward = ['--url', '--concurrency', '--requests', '--max-p95', '--max-p99', '--min-success-rate'];
  for (const key of loadForward) {
    const index = process.argv.indexOf(key);
    if (index !== -1) {
      loadArgs.push(key, process.argv[index + 1]);
    }
  }

  if (!loadArgs.includes('--url')) {
    loadArgs.push('--url', `${baseUrl}/performance/products/1`);
  }

  console.log('RELEASE GATE START');

  run('npm', ['run', 'build:performance'], 'build:performance');
  const loadGateOutput = run('npm', ['run', 'load:gate', '--', ...loadArgs], 'load:gate', { capture: true });
  const loadSnapshot = parseKeyValueLines(loadGateOutput);

  const [redisHealth, cacheMetrics, rateLimitMetrics, overviewMetrics, sessionMetrics] = await Promise.all([
    fetchJson(`${baseUrl}/performance/health/redis`),
    fetchJson(`${baseUrl}/performance/metrics/cache`),
    fetchJson(`${baseUrl}/performance/metrics/rate-limit`),
    fetchJson(`${baseUrl}/performance/metrics/overview`),
    fetchJson(`${baseUrl}/performance/metrics/sessions`),
  ]);

  if (requireRedisHealth && !redisHealth.ok) {
    throw new Error('Redis health check failed while REQUIRE_REDIS_HEALTH=true');
  }

  if (Number(cacheMetrics.error ?? 0) > maxCacheErrorMetric) {
    throw new Error(`Cache error metric too high: ${cacheMetrics.error} > ${maxCacheErrorMetric}`);
  }

  if (Number(rateLimitMetrics.error ?? 0) > maxRateLimitErrorMetric) {
    throw new Error(`Rate-limit error metric too high: ${rateLimitMetrics.error} > ${maxRateLimitErrorMetric}`);
  }

  if (Number(rateLimitMetrics.fallbackEmergency ?? 0) > maxFallbackEmergencyMetric) {
    throw new Error(`Rate-limit fallback emergency too high: ${rateLimitMetrics.fallbackEmergency} > ${maxFallbackEmergencyMetric}`);
  }

  if (Number(rateLimitMetrics.banBlocked ?? 0) > maxBanBlockedMetric) {
    throw new Error(`Rate-limit ban blocked too high: ${rateLimitMetrics.banBlocked} > ${maxBanBlockedMetric}`);
  }

  if (Number(sessionMetrics.evicted ?? 0) > maxSessionEvictedMetric) {
    throw new Error(`Session evictions too high: ${sessionMetrics.evicted} > ${maxSessionEvictedMetric}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    requireRedisHealth,
    thresholds: {
      maxCacheErrorMetric,
      maxRateLimitErrorMetric,
      maxFallbackEmergencyMetric,
      maxBanBlockedMetric,
      maxSessionEvictedMetric,
    },
    loadSnapshot,
    redisHealth,
    cacheMetrics,
    rateLimitMetrics,
    overviewMetrics,
    sessionMetrics,
  };

  const reportsDir = resolve(process.cwd(), 'reports');
  mkdirSync(reportsDir, { recursive: true });

  const reportPath = resolve(reportsDir, 'performance-release-gate-report.json');
  let previousReport = null;
  if (existsSync(reportPath)) {
    try {
      previousReport = JSON.parse(readFileSync(reportPath, 'utf8'));
    } catch {
      previousReport = null;
    }
  }

  if (previousReport) {
    report.deltaFromPrevious = {
      cacheHitRatio: Number((Number(report.cacheMetrics.hitRatio ?? 0) - Number(previousReport.cacheMetrics?.hitRatio ?? 0)).toFixed(4)),
      rateLimitBlockRatio: Number((Number(report.rateLimitMetrics.blockRatio ?? 0) - Number(previousReport.rateLimitMetrics?.blockRatio ?? 0)).toFixed(4)),
    };
  }

  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('RELEASE GATE PASS');
  console.log(`report=${reportPath}`);
}

main().catch((error) => {
  console.error(`RELEASE GATE FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
