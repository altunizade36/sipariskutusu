#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const root = process.cwd();

function readText(relPath) {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) return '';
  return fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '');
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function walk(dir, acc = []) {
  const absDir = path.join(root, dir);
  if (!fs.existsSync(absDir)) return acc;

  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.expo') {
      continue;
    }

    const rel = path.join(dir, entry.name);
    const abs = path.join(root, rel);

    if (entry.isDirectory()) {
      walk(rel, acc);
      continue;
    }

    if (/\.(ts|tsx|js|mjs|cjs|json|md|sql|yml|yaml)$/i.test(entry.name)) {
      acc.push(rel.replace(/\\/g, '/'));
    }
  }

  return acc;
}

function grepAny(files, pattern) {
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  return files.some((rel) => regex.test(readText(rel)));
}

function grepFile(relPath, pattern) {
  if (!exists(relPath)) return false;
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  return regex.test(readText(relPath));
}

const files = walk('.');
const codeFiles = files.filter((rel) => /\.(ts|tsx|js|mjs|cjs|json)$/i.test(rel));
const docFiles = files.filter((rel) => /\.(md|yml|yaml)$/i.test(rel));
const migrationFiles = walk('supabase/migrations');
const scanCodeFiles = codeFiles.filter((rel) => rel !== 'scripts/reliability-gate.mjs');
const packageJson = JSON.parse(readText('package.json') || '{}');
const scripts = packageJson.scripts ?? {};

const checks = [
  {
    id: 1,
    title: 'Lansman öncesi yük/smoke testi var',
    ok: Boolean(scripts['smoke:auth'] && scripts['smoke:reactions']),
    fix: 'smoke test scriptlerini CI pipeline’da zorunlu çalıştır.',
  },
  {
    id: 2,
    title: 'Server memory session kullanım izi yok',
    ok: !grepAny(scanCodeFiles, /express-session|MemoryStore|in-memory session/i),
    fix: 'Session gerekiyorsa Redis gibi merkezi store kullan.',
  },
  {
    id: 3,
    title: 'Yüklemeler object storage üzerinden',
    ok: scanCodeFiles.some((rel) => {
      const text = readText(rel);
      return text.includes('.storage') && text.includes('.upload(');
    }),
    fix: 'Dosya yüklemelerini yalnızca object storage üstünden yap.',
  },
  {
    id: 4,
    title: 'Sync email API rotası izi yok',
    ok: !grepAny(scanCodeFiles, /nodemailer|smtp\.send|sendmail\(/i),
    fix: 'E-posta gönderimini queue/worker modeline taşı.',
  },
  {
    id: 5,
    title: 'Queue/worker altyapısı',
    ok: grepAny(scanCodeFiles, /queue|worker|bull|job/i),
    fix: 'Ağır işleri queue tabanlı hale getir.',
    level: 'warn',
  },
  {
    id: 6,
    title: 'Kod içinde hardcoded secret yok',
    ok: !grepAny(scanCodeFiles, /sb_secret_|AIza[0-9A-Za-z_\-]{20,}|sk_live_|-----BEGIN (RSA|PRIVATE) KEY-----/),
    fix: 'Secretları env/secret manager’a taşı ve key rotate et.',
  },
  {
    id: 7,
    title: 'Read replica stratejisi dokümante',
    ok: grepFile('README.md', /read replica|replica/i) || grepFile('YONETIM_REHBERI.md', /read replica|replica/i),
    fix: 'Read-heavy akış için replica planı dokümante et.',
    level: 'warn',
  },
  {
    id: 8,
    title: 'CDN/edge cache kullanımı dokümante',
    ok: grepAny(docFiles, /cdn|cache-control|edge/i),
    fix: 'Statik varlıklar için CDN ve cache header tanımla.',
    level: 'warn',
  },
  {
    id: 9,
    title: 'Migration startup’ta otomatik tetiklenmiyor',
    ok: !grepAny(scanCodeFiles, /startup.*migrat|on boot.*migrat|migrate\(\)/i),
    fix: 'Migrationları ayrı CI/CD adımında tekil çalıştır.',
  },
  {
    id: 10,
    title: 'Backup-restore tatbikatı dokümante',
    ok: grepFile('YONETIM_REHBERI.md', /restore|yedek|backup/i) || grepFile('LIVE_DRY_RUN_CHECKLIST.md', /restore|yedek|backup/i),
    fix: 'Periyodik restore tatbikatı adımlarını yaz.',
    level: 'warn',
  },
  {
    id: 11,
    title: 'FK/index farkındalığı migrationlarda var',
    ok: grepAny(migrationFiles, /create index|index /i),
    fix: 'FK ve yoğun filtre kolonlarına index ekle.',
    level: 'warn',
  },
  {
    id: 12,
    title: 'Rate-limit / abuse koruması notları var',
    ok: grepFile('README.md', /rate limit|attack protection|captcha/i),
    fix: 'Auth rate-limit ve captcha ayarlarını zorunlu hale getir.',
  },
  {
    id: 13,
    title: 'Sıkıştırma stratejisi belirtilmiş',
    ok: grepAny(docFiles, /gzip|brotli|compression/i) || grepAny(scanCodeFiles, /gzip|brotli|compression/i),
    fix: 'API gateway katmanında gzip/brotli aktif et.',
    level: 'warn',
  },
  {
    id: 14,
    title: 'Hata izleme/uyarı sistemi var',
    ok: grepAny(scanCodeFiles, /sentry|posthog|alert/i),
    fix: 'Sentry alert ve on-call bildirim kuralı tanımla.',
  },
  {
    id: 15,
    title: 'Çok adımlı yazımlar için transaction yaklaşımı',
    ok: grepAny(migrationFiles, /begin;|commit;|transaction/i) || grepAny(scanCodeFiles, /rpc\(/i),
    fix: 'Çok adımlı yazımı SQL transaction veya RPC içine topla.',
    level: 'warn',
  },
  {
    id: 16,
    title: 'Health/readiness yaklaşımı dokümante',
    ok: grepAny(docFiles, /health|readyz|liveness/i) || grepAny(scanCodeFiles, /health|readyz|liveness/i),
    fix: 'API/worker için health endpoint stratejisi ekle.',
    level: 'warn',
  },
  {
    id: 17,
    title: 'Bellek izleme stratejisi',
    ok: grepAny(docFiles, /memory|profil|heap/i) || grepAny(scanCodeFiles, /memory|profil|heap/i),
    fix: 'Uzun yaşayan süreçler için memory metric ve alarm ekle.',
    level: 'warn',
  },
  {
    id: 18,
    title: 'Graceful shutdown stratejisi',
    ok: grepAny(docFiles, /graceful|shutdown|SIGTERM/i) || grepAny(scanCodeFiles, /graceful|shutdown|SIGTERM/i),
    fix: 'Server/worker süreçlerinde graceful shutdown uygula.',
    level: 'warn',
  },
  {
    id: 19,
    title: 'Üçüncü taraf fallback yaklaşımı',
    ok: grepAny(scanCodeFiles, /fallback|degraded|provider/i) || grepAny(docFiles, /fallback|degraded|provider/i),
    fix: 'Kritik dış servisler için fallback/degraded mode ekle.',
    level: 'warn',
  },
  {
    id: 20,
    title: 'Merkezi log yaklaşımı dokümante',
    ok: grepAny(docFiles, /log|audit/i) || grepAny(scanCodeFiles, /log|audit/i),
    fix: 'Olay sonrası inceleme için merkezi log tut.',
    level: 'warn',
  },
  {
    id: 21,
    title: 'Circuit breaker kullanımı',
    ok: grepAny(scanCodeFiles, /CircuitBreaker/),
    fix: 'Dış çağrılar için circuit breaker katmanı ekle.',
  },
  {
    id: 22,
    title: 'Arama sorgusunda parametreli yaklaşım',
    ok: grepAny(scanCodeFiles, /textSearch\(|ilike\(/),
    fix: 'Arama sorgularını index-friendly ve parametreli tasarla.',
  },
  {
    id: 23,
    title: 'Giden çağrılarda timeout var',
    ok: grepAny(scanCodeFiles, /withTimeout|AbortController|timeoutMs/i),
    fix: 'Tüm dış çağrılara timeout koy.',
  },
  {
    id: 24,
    title: 'Realtime altyapı yönetilen servisle',
    ok: grepAny(scanCodeFiles, /supabase.*realtime|onAuthStateChange|channel/i),
    fix: 'Stateful websocket yerine yönetilen realtime/pubsub kullan.',
  },
  {
    id: 25,
    title: 'Incident runbook mevcut',
    ok: exists('YONETIM_REHBERI.md') || exists('LIVE_DRY_RUN_CHECKLIST.md'),
    fix: 'En az 10 kritik olay için runbook oluştur.',
  },
];

let blockingFailures = 0;
let warningFailures = 0;

console.log('RELIABILITY GATE');
console.log('----------------');

for (const check of checks) {
  const level = check.level ?? 'block';
  if (check.ok) {
    console.log(`PASS [${check.id}] ${check.title}`);
    continue;
  }

  if (level === 'warn') {
    warningFailures += 1;
    console.log(`WARN [${check.id}] ${check.title}`);
  } else {
    blockingFailures += 1;
    console.log(`FAIL [${check.id}] ${check.title}`);
  }
  console.log(`  -> ${check.fix}`);
}

console.log('----------------');
console.log(`Blocking failures: ${blockingFailures}`);
console.log(`Warnings: ${warningFailures}`);

if (blockingFailures > 0) {
  process.exit(1);
}
