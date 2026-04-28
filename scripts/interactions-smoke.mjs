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
} catch {}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error('INTERACTIONS SMOKE FAIL: Missing env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const resources = { users: [], comments: [], likes: [], favorites: [], conversations: [], messages: [] };

function stamp() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function createBuyer() {
  const email = `buyer${stamp()}@smoke.dev`;
  const password = `Smoke_${stamp()}!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Buyer Smoke' } });
  if (created.error) throw new Error(created.error.message);
  const id = created.data.user?.id;
  if (!id) throw new Error('buyer id missing');
  resources.users.push(id);

  await admin.from('profiles').upsert({ id, full_name: 'Buyer Smoke', role: 'user', updated_at: new Date().toISOString() }, { onConflict: 'id' });

  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw new Error(`buyer signIn failed: ${login.error.message}`);
  return { id, client };
}

async function cleanup() {
  for (const id of resources.messages) await admin.from('messages').delete().eq('id', id);
  for (const id of resources.conversations) await admin.from('conversations').delete().eq('id', id);
  for (const id of resources.comments) await admin.from('listing_comments').delete().eq('id', id);
  for (const id of resources.likes) await admin.from('likes').delete().eq('id', id);
  for (const id of resources.favorites) await admin.from('favorites').delete().eq('id', id);
  for (const id of resources.users) await admin.auth.admin.deleteUser(id);
}

async function main() {
  const { data: listing, error: listingError } = await admin
    .from('listings')
    .select('id,seller_id,status')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (listingError || !listing) {
    throw new Error(`active listing bulunamadı: ${listingError?.message ?? 'none'}`);
  }

  const buyer = await createBuyer();

  const out = [];

  const comment = await buyer.client
    .from('listing_comments')
    .insert({ listing_id: listing.id, user_id: buyer.id, comment: 'Smoke comment' })
    .select('id')
    .single();
  if (comment.error || !comment.data) out.push(`FAIL yorum: ${comment.error?.message ?? 'insert failed'}`);
  else {
    resources.comments.push(comment.data.id);
    out.push(`PASS yorum: ${comment.data.id}`);
  }

  const like = await buyer.client
    .from('likes')
    .insert({ listing_id: listing.id, user_id: buyer.id })
    .select('id')
    .single();
  if (like.error || !like.data) out.push(`FAIL beğeni: ${like.error?.message ?? 'insert failed'}`);
  else {
    resources.likes.push(like.data.id);
    out.push(`PASS beğeni: ${like.data.id}`);
  }

  const fav = await buyer.client
    .from('favorites')
    .insert({ listing_id: listing.id, user_id: buyer.id })
    .select('id')
    .single();
  if (fav.error || !fav.data) out.push(`FAIL favori: ${fav.error?.message ?? 'insert failed'}`);
  else {
    resources.favorites.push(fav.data.id);
    out.push(`PASS favori: ${fav.data.id}`);
  }

  const conv = await admin
    .from('conversations')
    .insert({ buyer_id: buyer.id, seller_id: listing.seller_id, listing_id: listing.id })
    .select('id')
    .single();
  if (conv.error || !conv.data) {
    out.push(`FAIL mesaj(conversation): ${conv.error?.message ?? 'insert failed'}`);
  } else {
    resources.conversations.push(conv.data.id);
    const msg = await buyer.client
      .from('messages')
      .insert({ conversation_id: conv.data.id, sender_id: buyer.id, receiver_id: listing.seller_id, body: 'Smoke message', message_type: 'text', status: 'sent' })
      .select('id')
      .single();

    if (msg.error || !msg.data) {
      out.push(`FAIL mesaj(insert): ${msg.error?.message ?? 'insert failed'}`);
    } else {
      resources.messages.push(msg.data.id);
      out.push(`PASS mesaj(insert): ${msg.data.id}`);
    }
  }

  console.log('INTERACTIONS SMOKE RESULTS');
  for (const line of out) console.log(line);
}

main()
  .catch((e) => {
    console.error(`INTERACTIONS SMOKE FAIL: ${e.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
