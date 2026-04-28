import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');

try {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env is optional in CI when environment variables are already provided.
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return '';
  return process.argv[index + 1] ?? '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error('NOTIFICATION SMOKE FAIL: Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const explicitEmail = getArg('--email').trim();
const explicitPassword = getArg('--password').trim();
const explicitAccessToken = getArg('--access-token').trim() || process.env.SMOKE_ACCESS_TOKEN || '';
const keepUser = getArg('--keep-user') === 'true' || Boolean(explicitEmail);

const smokeEmail = explicitEmail || `notifsmoke+${Date.now()}@smoke.dev`;
const smokePassword = explicitPassword || `NotifSmoke_${Date.now()}!`;

let userId = null;
let createdUser = false;
let tokenValue = '';
let requestId = '';

async function ensureUser() {
  if (explicitAccessToken) {
    const tokenClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${explicitAccessToken}`,
        },
      },
    });

    const { data: authData, error: authError } = await tokenClient.auth.getUser();
    if (authError || !authData.user) {
      throw new Error(`access-token validation failed: ${authError?.message ?? 'invalid token'}`);
    }

    userId = authData.user.id;
    return;
  }

  if (!explicitEmail) {
    const created = await admin.auth.admin.createUser({
      email: smokeEmail,
      password: smokePassword,
      email_confirm: true,
      user_metadata: { full_name: 'Notification Smoke' },
    });

    if (created.error) {
      throw new Error(`admin.createUser failed: ${created.error.message}`);
    }

    userId = created.data.user?.id ?? null;
    if (!userId) {
      throw new Error('admin.createUser returned no user id');
    }

    createdUser = true;
  }

  const signedIn = await anon.auth.signInWithPassword({
    email: smokeEmail,
    password: smokePassword,
  });

  if (signedIn.error) {
    if (/Email logins are disabled/i.test(signedIn.error.message)) {
      throw new Error('signIn failed: Email logins are disabled. Use --access-token <JWT> or set SMOKE_ACCESS_TOKEN.');
    }
    throw new Error(`signIn failed: ${signedIn.error.message}`);
  }

  userId = userId ?? signedIn.data.user?.id ?? null;
  if (!userId) {
    throw new Error('signIn returned no user id');
  }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: userId, full_name: 'Notification Smoke', updated_at: new Date().toISOString() }, { onConflict: 'id' });

  if (profileError) {
    throw new Error(`profile upsert failed: ${profileError.message}`);
  }
}

async function seedPushToken() {
  tokenValue = `ExpoPushToken[SMOKE_${Date.now()}]`;

  const { error } = await admin
    .from('user_push_tokens')
    .upsert({
      user_id: userId,
      token: tokenValue,
      platform: 'android',
      provider: 'expo',
      is_active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,token',
    });

  if (error) {
    throw new Error(`user_push_tokens upsert failed: ${error.message}`);
  }
}

async function callDispatch() {
  const invokeClient = explicitAccessToken
    ? createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          headers: {
            Authorization: `Bearer ${explicitAccessToken}`,
          },
        },
      })
    : anon;

  const { data, error } = await invokeClient.functions.invoke('dispatch-notification', {
    body: {
      channels: ['push'],
      userIds: [userId],
      push: {
        title: 'Notification Smoke',
        body: `request ${Date.now()}`,
        data: {
          kind: 'notification_smoke',
        },
      },
    },
  });

  if (error) {
    throw new Error(`dispatch-notification invoke failed: ${error.message}`);
  }

  if (!data || typeof data !== 'object' || data.ok !== true) {
    throw new Error('dispatch-notification returned non-ok response');
  }

  if (!data.requestId || typeof data.requestId !== 'string') {
    throw new Error('dispatch-notification response missing requestId');
  }

  requestId = data.requestId;

  const pushMetrics = data.channels?.push;
  if (!pushMetrics || typeof pushMetrics.queued !== 'number') {
    throw new Error('dispatch-notification response missing push metrics');
  }

  return pushMetrics;
}

async function assertDeliveryLog() {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const { data, error } = await admin
      .from('notification_deliveries')
      .select('channel,status,recipient,request_id')
      .eq('request_id', requestId)
      .eq('channel', 'push');

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }

    await sleep(300);
  }

  throw new Error('notification_deliveries rows not found for request_id');
}

async function cleanup() {
  if (tokenValue) {
    await admin
      .from('user_push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', tokenValue);
  }

  if (!explicitAccessToken) {
    await anon.auth.signOut();
  }

  if (createdUser && userId && !keepUser) {
    await admin.auth.admin.deleteUser(userId);
  }
}

async function main() {
  await ensureUser();
  await seedPushToken();
  const pushMetrics = await callDispatch();
  const deliveries = await assertDeliveryLog();

  const sentCount = deliveries.filter((row) => row.status === 'sent').length;
  const failedCount = deliveries.filter((row) => row.status === 'failed').length;

  console.log('NOTIFICATION SMOKE PASS');
  console.log(`email=${smokeEmail}`);
  console.log(`user_id=${userId}`);
  console.log(`request_id=${requestId}`);
  console.log(`push_queued=${pushMetrics.queued ?? 0}`);
  console.log(`push_delivered=${pushMetrics.delivered ?? 0}`);
  console.log(`push_failed=${pushMetrics.failed ?? 0}`);
  console.log(`delivery_rows=${deliveries.length}`);
  console.log(`delivery_sent=${sentCount}`);
  console.log(`delivery_failed=${failedCount}`);
}

main()
  .catch((error) => {
    console.error(`NOTIFICATION SMOKE FAIL: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
