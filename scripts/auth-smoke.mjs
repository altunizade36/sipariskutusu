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
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // allow CI / shell env injection
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error('AUTH SMOKE FAIL: Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return '';
  return process.argv[index + 1] ?? '';
}

const explicitEmail = getArg('--email').trim();
const explicitPassword = getArg('--password').trim();
const fullName = getArg('--full-name').trim() || 'Auth Smoke';
const smokeEmailDomain = (process.env.SMOKE_TEST_EMAIL_DOMAIN || 'mailinator.com').trim();
const email = explicitEmail || `authsmoke+${Date.now()}@${smokeEmailDomain}`;
const password = explicitPassword || `AuthSmoke_${Date.now()}!`;
const mode = getArg('--mode') || 'register-and-login';
const keepUser = getArg('--keep-user') === 'true' || Boolean(explicitEmail);

let userId = null;

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableSignupError(message) {
  const lower = message.toLowerCase();
  return lower.includes('rate') || lower.includes('too many') || lower.includes('429') || lower.includes('limit exceeded');
}

function isExistingUserError(message) {
  const lower = message.toLowerCase();
  return lower.includes('already registered') || lower.includes('already been registered') || lower.includes('user already registered');
}

async function signUpWithRetry() {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const signUp = await anon.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (!signUp.error) {
      return signUp;
    }

    lastError = signUp.error;
    if (!isRetryableSignupError(signUp.error.message) || attempt === 3) {
      throw signUp.error;
    }

    const waitMs = attempt * 5000;
    console.log(`SIGN_UP_RETRY attempt=${attempt} wait_ms=${waitMs} reason=${signUp.error.message}`);
    await timeout(waitMs);
  }

  throw lastError ?? new Error('signUp failed');
}

async function main() {
  let signupStatus = 'skipped';

  if (mode === 'register-and-login') {
    try {
      const signUp = await signUpWithRetry();

      if (signUp.error) {
        throw signUp.error;
      }

      userId = signUp.data.user?.id ?? null;
      if (!userId) {
        throw new Error('signUp returned no user');
      }

      const confirm = await admin.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });

      if (confirm.error) {
        throw confirm.error;
      }

      signupStatus = 'created';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (explicitEmail && isExistingUserError(message)) {
        signupStatus = 'existing-user';
      } else {
        throw error;
      }
    }
  } else if (mode === 'login-only-admin-seeded') {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (created.error) {
      throw created.error;
    }

    userId = created.data.user?.id ?? null;
    if (!userId) {
      throw new Error('admin.createUser returned no user');
    }

    signupStatus = 'admin-seeded';
  } else if (mode === 'login-only-existing-user') {
    signupStatus = 'existing-user-login';
  } else {
    throw new Error('Invalid mode. Use --mode register-and-login, --mode login-only-admin-seeded, or --mode login-only-existing-user');
  }

  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    throw new Error(`signIn failed: ${signIn.error.message}`);
  }

  userId = userId ?? signIn.data.user?.id ?? null;
  if (!userId) {
    throw new Error('signIn returned no user');
  }

  const profile = await admin.from('profiles').select('id, full_name').eq('id', userId).single();
  if (profile.error || !profile.data) {
    throw new Error(`profile check failed: ${profile.error?.message ?? 'not found'}`);
  }

  const signOut = await anon.auth.signOut();
  if (signOut.error) {
    throw new Error(`signOut failed: ${signOut.error.message}`);
  }

  console.log('AUTH SMOKE PASS');
  console.log(`mode=${mode}`);
  console.log(`signup_status=${signupStatus}`);
  console.log(`email=${email}`);
  console.log(`user_id=${userId}`);
  console.log(`profile_full_name=${profile.data.full_name ?? ''}`);
}

main()
  .catch((error) => {
    console.error(`AUTH SMOKE FAIL: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (userId && !keepUser) {
      await admin.auth.admin.deleteUser(userId);
    }
  });
