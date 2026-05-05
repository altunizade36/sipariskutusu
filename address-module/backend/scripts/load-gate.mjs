/*
  SLO gate wrapper for load tests.
  Fails CI/CD when latency or success-rate thresholds are violated.

  Example:
  node scripts/load-gate.mjs --url http://localhost:4100/performance/products/1 --concurrency 50 --requests 2000 --max-p95 250 --max-p99 600 --min-success-rate 0.995
*/

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value ?? fallback;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

const targetUrl = getArg('--url', 'http://localhost:4100/performance/products/1');
const concurrency = Number(getArg('--concurrency', '30'));
const requests = Number(getArg('--requests', '1000'));
const maxP95 = Number(getArg('--max-p95', process.env.SLO_MAX_P95_MS ?? '250'));
const maxP99 = Number(getArg('--max-p99', process.env.SLO_MAX_P99_MS ?? '600'));
const minSuccessRate = Number(getArg('--min-success-rate', process.env.SLO_MIN_SUCCESS_RATE ?? '0.995'));

if (!Number.isFinite(concurrency) || !Number.isFinite(requests) || concurrency <= 0 || requests <= 0) {
  console.error('LOAD GATE FAIL: invalid concurrency/requests');
  process.exit(1);
}

let cursor = 0;
let success = 0;
let failed = 0;
let rateLimited = 0;
const latencies = [];

async function runOne() {
  const start = Date.now();
  try {
    const response = await fetch(targetUrl, { method: 'GET' });
    const elapsed = Date.now() - start;
    latencies.push(elapsed);

    if (response.status === 429) {
      rateLimited += 1;
      failed += 1;
      return;
    }

    if (response.ok) {
      success += 1;
      return;
    }

    failed += 1;
  } catch {
    const elapsed = Date.now() - start;
    latencies.push(elapsed);
    failed += 1;
  }
}

async function worker() {
  while (true) {
    const index = cursor;
    cursor += 1;
    if (index >= requests) return;

    await runOne();
  }
}

async function main() {
  const startedAt = Date.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const durationMs = Date.now() - startedAt;

  latencies.sort((a, b) => a - b);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const successRate = requests > 0 ? success / requests : 0;

  const checks = [
    { ok: p95 <= maxP95, message: `p95 ${p95}ms <= ${maxP95}ms` },
    { ok: p99 <= maxP99, message: `p99 ${p99}ms <= ${maxP99}ms` },
    { ok: successRate >= minSuccessRate, message: `successRate ${successRate.toFixed(4)} >= ${minSuccessRate}` },
  ];

  console.log('LOAD GATE RESULT');
  console.log(`url=${targetUrl}`);
  console.log(`duration_ms=${durationMs}`);
  console.log(`requests=${requests}`);
  console.log(`concurrency=${concurrency}`);
  console.log(`success=${success}`);
  console.log(`failed=${failed}`);
  console.log(`rate_limited_429=${rateLimited}`);
  console.log(`p95_ms=${p95}`);
  console.log(`p99_ms=${p99}`);
  console.log(`success_rate=${successRate.toFixed(4)}`);

  const failedChecks = checks.filter((check) => !check.ok);
  if (failedChecks.length > 0) {
    for (const check of failedChecks) {
      console.error(`LOAD GATE FAIL: ${check.message}`);
    }
    process.exit(1);
  }

  console.log('LOAD GATE PASS');
}

main().catch((error) => {
  console.error(`LOAD GATE FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
