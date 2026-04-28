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
  // allow CI/shell env
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error('FULL FLOW SMOKE FAIL: Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
const resources = {
  users: [],
  listings: [],
  comments: [],
  favorites: [],
  likes: [],
  conversations: [],
  messages: [],
  storagePaths: [],
};

function stamp() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
}

async function makeUser(label, role = 'buyer') {
  const email = `${label}${stamp()}@smoke.dev`;
  const password = `Smoke_${stamp()}!`;

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Smoke ${label}` },
  });

  if (created.error) {
    throw new Error(`createUser(${label}) failed: ${created.error.message}`);
  }

  const id = created.data.user?.id;
  if (!id) throw new Error(`createUser(${label}) returned no id`);

  resources.users.push(id);

  await admin
    .from('profiles')
    .upsert({
      id,
      full_name: `Smoke ${label}`,
      role,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) {
    throw new Error(`signIn(${label}) failed: ${signedIn.error.message}`);
  }

  return { id, email, password, client };
}

async function cleanup() {
  for (const path of resources.storagePaths) {
    await admin.storage.from('listing-images').remove([path]);
  }

  for (const id of resources.messages) {
    await admin.from('messages').delete().eq('id', id);
  }

  for (const id of resources.conversations) {
    await admin.from('conversations').delete().eq('id', id);
  }

  for (const id of resources.comments) {
    await admin.from('listing_comments').delete().eq('id', id);
  }

  for (const id of resources.likes) {
    await admin.from('likes').delete().eq('id', id);
  }

  for (const id of resources.favorites) {
    await admin.from('favorites').delete().eq('id', id);
  }

  for (const id of resources.listings) {
    await admin.from('listing_images').delete().eq('listing_id', id);
    await admin.from('listings').delete().eq('id', id);
  }

  for (const id of resources.users) {
    await admin.auth.admin.deleteUser(id);
  }
}

async function getAnyActiveCategoryId() {
  const res = await admin
    .from('categories')
    .select('id')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    throw new Error(`categories lookup failed: ${res.error.message}`);
  }

  if (!res.data?.id) {
    throw new Error('categories lookup returned no active category');
  }

  return res.data.id;
}

async function main() {
  const seller = await makeUser('seller', 'seller');
  const buyer = await makeUser('buyer', 'buyer');
  const adminUser = await makeUser('admin', 'admin');
  const categoryId = await getAnyActiveCategoryId();

  // 1) Sign-up smoke (real anon signUp)
  {
    const signUpClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `signup${stamp()}@smoke.dev`;
    const password = `Signup_${stamp()}!`;
    const signUp = await signUpClient.auth.signUp({ email, password });

    if (signUp.error) {
      record('Kayıt ol', false, signUp.error.message);
    } else {
      const newUserId = signUp.data.user?.id;
      record('Kayıt ol', true, newUserId ? `user_id=${newUserId}` : 'ok');
      record('E-posta doğrulama', signUp.data.session == null, signUp.data.session == null ? 'session yok (confirm email bekleniyor olabilir)' : 'session var');
      if (newUserId) resources.users.push(newUserId);
    }
  }

  // 2) Login
  {
    const login = await seller.client.auth.signInWithPassword({
      email: seller.email,
      password: seller.password,
    });
    record('Giriş yap', !login.error, login.error?.message ?? 'ok');
  }

  // 3) Forgot password
  {
    const forgot = await seller.client.auth.resetPasswordForEmail(seller.email, {
      redirectTo: 'sipariskutusu://reset-password',
    });
    record('Şifremi unuttum', !forgot.error, forgot.error?.message ?? 'reset mail talebi kabul edildi');
  }

  // 4) Listing create -> pending
  let listingId = '';
  {
    const ins = await seller.client
      .from('listings')
      .insert({
        seller_id: seller.id,
        title: `Smoke Listing ${stamp()}`,
        description: 'Full flow smoke listing',
        price: 123,
        category_id: categoryId,
        condition: 'good',
        delivery: 'both',
      })
      .select('id,status')
      .single();

    if (ins.error || !ins.data) {
      record('İlan ekleme', false, ins.error?.message ?? 'insert failed');
    } else {
      listingId = ins.data.id;
      resources.listings.push(listingId);
      record('İlan ekleme', true, `listing_id=${listingId}`);
      record('Pending durumu', ins.data.status === 'pending', `status=${ins.data.status}`);
    }
  }

  // 5) Image upload + listing_images row
  {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const path = `${seller.id}/${stamp()}.png`;
    const up = await seller.client.storage
      .from('listing-images')
      .upload(path, bytes, { contentType: 'image/png', upsert: false });

    if (up.error) {
      record('Görsel yükleme', false, up.error.message);
    } else {
      resources.storagePaths.push(path);
      record('Görsel yükleme', true, path);

      if (listingId) {
        const pub = seller.client.storage.from('listing-images').getPublicUrl(path);
        const img = await seller.client
          .from('listing_images')
          .insert({ listing_id: listingId, url: pub.data.publicUrl, storage_path: path, is_cover: true, sort_order: 0 })
          .select('id')
          .single();

        if (img.error || !img.data) {
          record('İlan görsel kaydı', false, img.error?.message ?? 'insert failed');
        } else {
          record('İlan görsel kaydı', true, `image_id=${img.data.id}`);
        }
      }
    }
  }

  // 6) Admin approve -> active
  {
    if (!listingId) {
      record('Admin onayı', false, 'listing yok');
    } else {
      const rpc = await adminUser.client.rpc('review_listing_admin', {
        p_listing_id: listingId,
        p_decision: 'active',
        p_review_note: null,
      });

      if (rpc.error) {
        record('Admin onayı', false, rpc.error.message);
      } else {
        const check = await admin
          .from('listings')
          .select('status')
          .eq('id', listingId)
          .single();
        const status = check.data?.status;
        record('Admin onayı', status === 'active', `status=${status ?? 'unknown'}`);
      }
    }
  }

  // 7) Comment / like / favorite
  {
    if (!listingId) {
      record('Yorum', false, 'listing yok');
      record('Beğeni', false, 'listing yok');
      record('Favori', false, 'listing yok');
    } else {
      const c = await buyer.client.rpc('add_listing_comment', {
        p_listing_id: listingId,
        p_comment: 'Smoke yorum',
        p_parent_id: null,
      });
      if (c.error || !c.data) {
        record('Yorum', false, c.error?.message ?? 'insert failed');
      } else {
        resources.comments.push(c.data);
        record('Yorum', true, `comment_id=${c.data}`);
      }

      const l = await buyer.client
        .from('likes')
        .insert({ listing_id: listingId, user_id: buyer.id })
        .select('id')
        .single();
      if (l.error || !l.data) {
        record('Beğeni', false, l.error?.message ?? 'insert failed');
      } else {
        resources.likes.push(l.data.id);
        record('Beğeni', true, `like_id=${l.data.id}`);
      }

      const f = await buyer.client
        .from('favorites')
        .insert({ listing_id: listingId, user_id: buyer.id })
        .select('id')
        .single();
      if (f.error || !f.data) {
        record('Favori', false, f.error?.message ?? 'insert failed');
      } else {
        resources.favorites.push(f.data.id);
        record('Favori', true, `favorite_id=${f.data.id}`);
      }
    }
  }

  // 8) Message send
  {
    const conv = await admin
      .from('conversations')
      .insert({ buyer_id: buyer.id, seller_id: seller.id, listing_id: listingId || null })
      .select('id')
      .single();

    if (conv.error || !conv.data) {
      record('Mesaj gönderme', false, conv.error?.message ?? 'conversation create failed');
    } else {
      resources.conversations.push(conv.data.id);
      const msg = await buyer.client
        .from('messages')
        .insert({
          conversation_id: conv.data.id,
          sender_id: buyer.id,
          receiver_id: seller.id,
          body: 'Smoke mesaj',
          message_type: 'text',
          status: 'sent',
        })
        .select('id')
        .single();

      if (msg.error || !msg.data) {
        record('Mesaj gönderme', false, msg.error?.message ?? 'message insert failed');
      } else {
        resources.messages.push(msg.data.id);
        record('Mesaj gönderme', true, `message_id=${msg.data.id}`);
      }
    }
  }

  // 9) Notification dispatch
  {
    const pushToken = `ExpoPushToken[SMOKE_${stamp()}]`;
    await admin.from('user_push_tokens').upsert({
      user_id: buyer.id,
      token: pushToken,
      platform: 'android',
      provider: 'expo',
      is_active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,token' });

    const invoke = await buyer.client.functions.invoke('dispatch-notification', {
      body: {
        channels: ['push'],
        userIds: [buyer.id],
        push: {
          title: 'Smoke Notification',
          body: 'Test',
          data: { kind: 'full_flow_smoke' },
        },
      },
    });

    if (invoke.error) {
      record('Bildirim gönderimi', false, invoke.error.message);
    } else {
      const requestId = invoke.data?.requestId;
      if (!requestId) {
        record('Bildirim gönderimi', false, 'requestId dönmedi');
      } else {
        const delivery = await admin
          .from('notification_deliveries')
          .select('id')
          .eq('request_id', requestId)
          .limit(1);
        record('Bildirim gönderimi', !delivery.error && (delivery.data?.length ?? 0) > 0, delivery.error?.message ?? `rows=${delivery.data?.length ?? 0}`);
      }
    }

    await admin.from('user_push_tokens').delete().eq('user_id', buyer.id).eq('token', pushToken);
  }

  const passCount = results.filter((r) => r.ok).length;
  const failCount = results.length - passCount;

  console.log('FULL FLOW SMOKE RESULTS');
  for (const r of results) {
    const tag = r.ok ? 'PASS' : 'FAIL';
    console.log(`${tag} | ${r.name} | ${r.detail}`);
  }
  console.log(`SUMMARY | pass=${passCount} fail=${failCount}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(`FULL FLOW SMOKE FAIL: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
