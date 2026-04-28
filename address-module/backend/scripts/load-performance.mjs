/*
  Lightweight load script for performance endpoints.
  Usage:
    node scripts/load-performance.mjs --url http://localhost:4100/performance/products/1 --concurrency 50 --requests 2000
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
const method = getArg('--method', 'GET').toUpperCase();
const bodyArg = getArg('--body', '');

if (!Number.isFinite(concurrency) || concurrency <= 0 || !Number.isFinite(requests) || requests <= 0) {
  console.error('Invalid --concurrency or --requests value');
  process.exit(1);
}

const body = bodyArg ? JSON.parse(bodyArg) : undefined;
const latencies = [];
let success = 0;
let failed = 0;
let rateLimited = 0;

let cursor = 0;

async function runOne() {
  const start = Date.now();
  try {
    const response = await fetch(targetUrl, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const elapsed = Date.now() - start;
    latencies.push(elapsed);

    if (response.status === 429) {
      rateLimited += 1;
      failed += 1;
      return;
    }

    if (response.ok) {
      success += 1;
    } else {
      failed += 1;
    }
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
    if (index >= requests) {
      return;
    }

    await runOne();
  }
}

async function main() {
  const startAt = Date.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const totalMs = Date.now() - startAt;

  latencies.sort((a, b) => a - b);

  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const avg = latencies.length > 0 ? Math.round(latencies.reduce((acc, cur) => acc + cur, 0) / latencies.length) : 0;
  const rps = totalMs > 0 ? Number((requests / (totalMs / 1000)).toFixed(2)) : 0;

  console.log('LOAD TEST RESULT');
  console.log(`url=${targetUrl}`);
  console.log(`method=${method}`);
  console.log(`concurrency=${concurrency}`);
  console.log(`requests=${requests}`);
  console.log(`duration_ms=${totalMs}`);
  console.log(`rps=${rps}`);
  console.log(`success=${success}`);
  console.log(`failed=${failed}`);
  console.log(`rate_limited_429=${rateLimited}`);
  console.log(`p50_ms=${p50}`);
  console.log(`p95_ms=${p95}`);
  console.log(`p99_ms=${p99}`);
  console.log(`avg_ms=${avg}`);
}

main().catch((error) => {
  console.error(`LOAD TEST FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
