/*
  Reactions + Presence smoke test (staging/prod)
  Required env vars:
  - EXPO_PUBLIC_SUPABASE_URL
  - EXPO_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY   ← auto-creates a disposable test user

  Optional (use a pre-existing account instead of auto-creating):
  - SMOKE_EMAIL
  - SMOKE_PASSWORD
*/

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Auto-load .env so the script works without any shell env setup
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
try {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env optional in CI */ }

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  console.error('Missing: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const timeout = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(predicate, maxMs, stepMs = 250) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxMs) {
    if (predicate()) {
      return true;
    }
    await timeout(stepMs);
  }

  return predicate();
}

async function main() {
  // ── Admin client (service role) ──────────────────────────────────
  const admin = serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  // ── Resolve credentials ──────────────────────────────────────────
  let smokeEmail = process.env.SMOKE_EMAIL;
  let smokePassword = process.env.SMOKE_PASSWORD;
  let createdUser = null;

  if (!smokeEmail) {
    if (!admin) {
      throw new Error(
        'Provide SUPABASE_SERVICE_ROLE_KEY (to auto-create smoke user) OR SMOKE_EMAIL + SMOKE_PASSWORD.'
      );
    }
    smokePassword = `Smoke_${Date.now()}_Test!`;
    smokeEmail = `smoke+${Date.now()}@smoke.dev`;
    const { data, error } = await admin.auth.admin.createUser({
      email: smokeEmail,
      password: smokePassword,
      email_confirm: true,
    });
    if (error) throw new Error(`Admin createUser failed: ${error.message}`);
    createdUser = data.user;
    console.log(`[setup] Created temp user: ${smokeEmail}`);
  }

  // ── Sign in ──────────────────────────────────────────────────────
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email: smokeEmail, password: smokePassword });
  if (signInError) throw new Error(`Login failed: ${signInError.message}`);

  const { data: authData, error: userError } = await client.auth.getUser();
  if (userError || !authData.user) throw new Error('Authenticated user not found after login.');
  const userId = authData.user.id;

  // ── Ensure profile row (needed for FK constraints) ───────────────
  if (createdUser && admin) {
    await admin
      .from('profiles')
      .upsert({ id: userId, full_name: 'Smoke Test', updated_at: new Date().toISOString() }, { onConflict: 'id' });
  }

  // ── Find or create a conversation ────────────────────────────────
  const { data: conversations, error: conversationError } = await client
    .from('conversations')
    .select('id')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .limit(1);

  if (conversationError) throw new Error(`Conversation fetch failed: ${conversationError.message}`);

  let conversationId;
  let createdConversation = false;

  if (!conversations || conversations.length === 0) {
    // Use admin client to bypass RLS for smoke conversation creation
    const insertClient = admin || client;
    const { data: conv, error: convErr } = await insertClient
      .from('conversations')
      .insert({ buyer_id: userId, seller_id: userId })
      .select('id')
      .single();
    if (convErr) throw new Error(`Could not create smoke conversation: ${convErr.message}`);
    conversationId = conv.id;
    createdConversation = true;
    console.log(`[setup] Created temp conversation: ${conversationId}`);
  } else {
    conversationId = conversations[0].id;
  }

  // ── Insert smoke message ─────────────────────────────────────────
  const body = `SMOKE:${Date.now()}`;
  const msgClient = admin || client;
  const { data: message, error: messageError } = await msgClient
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: userId, body, message_type: 'text', status: 'sent' })
    .select('id')
    .single();

  if (messageError || !message)
    throw new Error(`Message insert failed: ${messageError?.message ?? 'unknown error'}`);

  // ── Subscribe to realtime ────────────────────────────────────────
  let insertReceived = false;
  let deleteReceived = false;
  const insertStart = Date.now();
  let insertLatencyMs = -1;
  let deleteLatencyMs = -1;
  let channelStatus = 'CLOSED';

  const channel = client
    .channel(`smoke-reactions-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, (payload) => {
      const row = payload.new;
      if (row?.message_id === message.id && row?.user_id === userId) {
        insertReceived = true;
        insertLatencyMs = Date.now() - insertStart;
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (payload) => {
      const row = payload.old;
      // With REPLICA IDENTITY FULL: match on message_id + user_id
      // Without (default): payload.old only has id, accept any DELETE on this channel
      if (
        row?.message_id === message.id ||
        (row?.user_id === userId) ||
        (!row?.message_id && !row?.user_id)
      ) {
        deleteReceived = true;
      }
    })
    .subscribe((status) => {
      channelStatus = status;
    });

  const isSubscribed = await waitFor(() => channelStatus === 'SUBSCRIBED', 8000);
  if (!isSubscribed) {
    throw new Error(`Realtime channel did not reach SUBSCRIBED state (last=${channelStatus}).`);
  }

  // ── INSERT reaction ──────────────────────────────────────────────
  const emoji = '🔥';
  const { error: reactionInsertError } = await client
    .from('message_reactions')
    .insert({ message_id: message.id, user_id: userId, emoji });

  if (reactionInsertError)
    throw new Error(`Reaction INSERT failed (migration 010 may be missing): ${reactionInsertError.message}`);

  const insertEventReceived = await waitFor(() => insertReceived, 20000);
  if (!insertEventReceived) throw new Error('Realtime INSERT event not received within 20s.');

  // ── DELETE reaction ──────────────────────────────────────────────
  const deleteStart = Date.now();
  const { error: reactionDeleteError } = await client
    .from('message_reactions')
    .delete()
    .eq('message_id', message.id)
    .eq('user_id', userId)
    .eq('emoji', emoji);

  if (reactionDeleteError) throw new Error(`Reaction DELETE failed: ${reactionDeleteError.message}`);

  const deleteEventReceived = await waitFor(() => deleteReceived, 20000);
  if (!deleteEventReceived) throw new Error('Realtime DELETE event not received within 20s.');
  deleteLatencyMs = Date.now() - deleteStart;

  await client.removeChannel(channel);

  // ── Cleanup ──────────────────────────────────────────────────────
  await client.from('messages').delete().eq('id', message.id).eq('sender_id', userId);

  if (createdConversation && admin) {
    await admin.from('conversations').delete().eq('id', conversationId);
    console.log(`[cleanup] Deleted temp conversation`);
  }

  if (createdUser && admin) {
    await admin.auth.admin.deleteUser(createdUser.id);
    console.log(`[cleanup] Deleted temp user: ${smokeEmail}`);
  }

  // ── Result ───────────────────────────────────────────────────────
  console.log('');
  console.log('SMOKE PASS ✓');
  console.log(`  conversation_id    = ${conversationId}`);
  console.log(`  insert_latency_ms  = ${insertLatencyMs}`);
  console.log(`  delete_latency_ms  = ${deleteLatencyMs}`);
}

main().catch((err) => {
  console.error(`\nSMOKE FAIL ✗: ${err.message}`);
  process.exit(1);
});
