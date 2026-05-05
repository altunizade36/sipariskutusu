import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function normalizeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .toLowerCase();
}

function run(commandLine) {
  return new Promise((resolve) => {
    const child = spawn(commandLine, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function hasRateLimit(text) {
  const lower = normalizeText(text);
  return (
    lower.includes('email rate limit exceeded') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  );
}

function hasTransientRealtimeIssue(text) {
  const lower = normalizeText(text);
  return (
    lower.includes('realtime insert event not received') ||
    lower.includes('realtime delete event not received') ||
    lower.includes('connect timeout') ||
    lower.includes('fetch failed')
  );
}

function hasSupabaseCliLinkIssue(text) {
  const lower = normalizeText(text);
  return lower.includes('cannot find project ref') || lower.includes('supabase link');
}

function parseFullFlowOnlyEmailBlocked(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const failLines = lines.filter((line) => line.startsWith('FAIL |'));
  if (failLines.length === 0) return false;

  const allowed = new Set(['kayit ol', 'sifremi unuttum']);
  return failLines.every((line) => {
    const parts = line.split('|').map((part) => part.trim());
    const step = normalizeText(parts[1] ?? '');
    const detail = normalizeText(parts[2] ?? '');
    return allowed.has(step) && hasRateLimit(detail);
  });
}

function parseEnvFile(content) {
  const map = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }

  return map;
}

function isPlaceholder(value) {
  if (!value) return true;
  const v = value.toLowerCase();
  return (
    v.includes('proje_id') ||
    v.includes('xxxx') ||
    v.includes('xxx') ||
    v.includes('...') ||
    v.includes('example') ||
    v.includes('your_') ||
    v.includes('placeholder')
  );
}

function getRuntimeEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return process.env;
  }

  const fileEnv = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  return {
    ...fileEnv,
    ...process.env,
  };
}

async function main() {
  const summary = [];
  const env = getRuntimeEnv();
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

  console.log('=== SYSTEM READINESS START ===');

  if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
    console.log('\nCONFIG BLOCKER | Supabase env eksik veya placeholder durumda');
    console.log('- EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY gercek deger olmadan smoke testler anlamsiz olur.');
    console.log('- Once .env degerlerini duzeltin, sonra tekrar: npm run system:ready');
    summary.push({ name: 'supabase_env', status: 'fail', detail: 'missing-or-placeholder' });

    console.log('\n=== SYSTEM READINESS SUMMARY ===');
    for (const item of summary) {
      console.log(`${item.status.toUpperCase()} | ${item.name} | ${item.detail}`);
    }
    console.log('TOTAL | pass=0 blocked=0 fail=1');
    process.exitCode = 1;
    return;
  }

  console.log('\n[1/6] auth smoke: register-and-login');
  const authMain = await run('npm run smoke:auth -- --mode register-and-login');

  if (authMain.code === 0) {
    summary.push({ name: 'auth_public_signup', status: 'pass', detail: 'register-and-login pass' });
  } else if (hasRateLimit(authMain.stdout + '\n' + authMain.stderr)) {
    summary.push({ name: 'auth_public_signup', status: 'blocked', detail: 'supabase email rate-limit' });

    console.log('\n[1b/6] auth smoke fallback: login-only-admin-seeded');
    const authFallback = await run('npm run smoke:auth -- --mode login-only-admin-seeded');
    summary.push({
      name: 'auth_login_core',
      status: authFallback.code === 0 ? 'pass' : 'fail',
      detail: authFallback.code === 0 ? 'admin-seeded login pass' : 'login fallback failed',
    });
  } else {
    summary.push({ name: 'auth_public_signup', status: 'fail', detail: 'auth smoke failed (non-rate-limit)' });
  }

  console.log('\n[2/6] reactions smoke');
  let reactions = await run('npm run smoke:reactions');
  if (reactions.code !== 0 && hasTransientRealtimeIssue(reactions.stdout + '\n' + reactions.stderr)) {
    console.log('[2b/6] reactions smoke retry (transient realtime/network)');
    reactions = await run('npm run smoke:reactions');
  }
  summary.push({
    name: 'reactions',
    status: reactions.code === 0 ? 'pass' : 'fail',
    detail: reactions.code === 0 ? 'ok' : 'failed',
  });

  console.log('\n[3/6] chat smoke');
  let chat = await run('npm run smoke:chat');
  if (chat.code !== 0 && hasTransientRealtimeIssue(chat.stdout + '\n' + chat.stderr)) {
    console.log('[3b/6] chat smoke retry (transient realtime/network)');
    chat = await run('npm run smoke:chat');
  }
  summary.push({
    name: 'chat',
    status: chat.code === 0 ? 'pass' : 'fail',
    detail: chat.code === 0 ? 'ok' : 'failed',
  });

  console.log('\n[4/6] notifications smoke');
  let notifications = await run('npm run smoke:notifications');
  if (notifications.code !== 0 && hasTransientRealtimeIssue(notifications.stdout + '\n' + notifications.stderr)) {
    console.log('[4b/6] notifications smoke retry (transient network)');
    notifications = await run('npm run smoke:notifications');
  }
  summary.push({
    name: 'notifications',
    status: notifications.code === 0 ? 'pass' : 'fail',
    detail: notifications.code === 0 ? 'ok' : 'failed',
  });

  console.log('\n[5/6] full-flow smoke');
  const fullFlow = await run('node scripts/full-flow-smoke.mjs');
  if (fullFlow.code === 0) {
    summary.push({ name: 'full_flow', status: 'pass', detail: 'all steps pass' });
  } else if (parseFullFlowOnlyEmailBlocked(fullFlow.stdout + '\n' + fullFlow.stderr)) {
    summary.push({ name: 'full_flow', status: 'blocked', detail: 'only email-rate-limit steps blocked' });
  } else {
    summary.push({ name: 'full_flow', status: 'fail', detail: 'has non-email blockers' });
  }

  console.log('\n[6/6] migration list');
  const migrations = await run('npx supabase migration list');
  summary.push({
    name: 'migration_list',
    status: migrations.code === 0 ? 'pass' : hasSupabaseCliLinkIssue(migrations.stdout + '\n' + migrations.stderr) ? 'blocked' : 'fail',
    detail:
      migrations.code === 0
        ? 'reachable'
        : hasSupabaseCliLinkIssue(migrations.stdout + '\n' + migrations.stderr)
          ? 'supabase-cli-not-linked'
          : 'failed',
  });

  const passCount = summary.filter((item) => item.status === 'pass').length;
  const blockedCount = summary.filter((item) => item.status === 'blocked').length;
  const failCount = summary.filter((item) => item.status === 'fail').length;

  console.log('\n=== SYSTEM READINESS SUMMARY ===');
  for (const item of summary) {
    console.log(`${item.status.toUpperCase()} | ${item.name} | ${item.detail}`);
  }
  console.log(`TOTAL | pass=${passCount} blocked=${blockedCount} fail=${failCount}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`SYSTEM READINESS FAIL: ${error.message}`);
  process.exitCode = 1;
});
