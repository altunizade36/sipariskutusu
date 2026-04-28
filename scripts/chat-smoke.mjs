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
  console.error('CHAT SMOKE FAIL: Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const resources = {
  users: [],
  conversations: [],
  messages: [],
  attachments: [],
  storagePaths: [],
  blocks: [],
  reports: [],
};

const results = [];

function stamp() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
}

async function createUser(label, role = 'buyer') {
  const email = `${label}${stamp()}@smoke.dev`;
  const password = `Smoke_${stamp()}!`;

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Chat Smoke ${label}` },
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
      full_name: `Chat Smoke ${label}`,
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
  for (const reportId of resources.reports) {
    await admin.from('report_actions').delete().eq('report_id', reportId);
    await admin.from('reports').delete().eq('id', reportId);
  }

  for (const blockId of resources.blocks) {
    await admin.from('user_blocks').delete().eq('id', blockId);
  }

  for (const attachmentId of resources.attachments) {
    await admin.from('message_attachments').delete().eq('id', attachmentId);
  }

  for (const messageId of resources.messages) {
    await admin.from('messages').delete().eq('id', messageId);
  }

  for (const conversationId of resources.conversations) {
    await admin.from('conversation_typing').delete().eq('conversation_id', conversationId);
    await admin.from('conversation_participants').delete().eq('conversation_id', conversationId);
    await admin.from('conversations').delete().eq('id', conversationId);
  }

  if (resources.storagePaths.length > 0) {
    await admin.storage.from('chat-attachments').remove(resources.storagePaths);
  }

  for (const userId of resources.users) {
    await admin.auth.admin.deleteUser(userId);
  }
}

async function main() {
  const buyer = await createUser('chatbuyer', 'buyer');
  const seller = await createUser('chatseller', 'seller');

  const conversationInsert = await admin
    .from('conversations')
    .insert({
      chat_type: 'direct',
      type: 'store_conversation',
      buyer_id: buyer.id,
      seller_id: seller.id,
      buyer_unread: 0,
      seller_unread: 0,
      buyer_unread_count: 0,
      seller_unread_count: 0,
    })
    .select('id')
    .single();

  if (conversationInsert.error || !conversationInsert.data?.id) {
    throw new Error(`conversation create failed: ${conversationInsert.error?.message ?? 'insert failed'}`);
  }

  const conversationId = conversationInsert.data.id;
  resources.conversations.push(conversationId);

  await admin.from('conversation_participants').upsert([
    { conversation_id: conversationId, user_id: buyer.id, role: 'member' },
    { conversation_id: conversationId, user_id: seller.id, role: 'member' },
  ], { onConflict: 'conversation_id,user_id' });

  // 1) Attachment upload + metadata
  {
    const bytes = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1]);
    const storagePath = `${conversationId}/${buyer.id}/${stamp()}.jpg`;
    const upload = await buyer.client.storage
      .from('chat-attachments')
      .upload(storagePath, bytes, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (upload.error) {
      record('Attachment upload', false, upload.error.message);
    } else {
      resources.storagePaths.push(storagePath);

      const publicUrl = buyer.client.storage.from('chat-attachments').getPublicUrl(storagePath).data.publicUrl;
      const msg = await buyer.client
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: buyer.id,
          receiver_id: seller.id,
          body: 'Attachment message',
          text: 'Attachment message',
          image_url: publicUrl,
          attachment_url: publicUrl,
          message_type: 'image',
          status: 'sent',
        })
        .select('id')
        .single();

      if (msg.error || !msg.data?.id) {
        record('Attachment message insert', false, msg.error?.message ?? 'insert failed');
      } else {
        resources.messages.push(msg.data.id);

        const attachment = await buyer.client
          .from('message_attachments')
          .insert({
            message_id: msg.data.id,
            file_url: publicUrl,
            file_type: 'image/jpeg',
            file_size: bytes.byteLength,
          })
          .select('id')
          .single();

        if (attachment.error || !attachment.data?.id) {
          record('Attachment metadata', false, attachment.error?.message ?? 'insert failed');
        } else {
          resources.attachments.push(attachment.data.id);
          record('Attachment upload', true, `path=${storagePath}`);
          record('Attachment metadata', true, `attachment_id=${attachment.data.id}`);
        }
      }
    }
  }

  // 2) Unread/read
  {
    const textMessage = await buyer.client
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: buyer.id,
        receiver_id: seller.id,
        body: 'Unread check message',
        text: 'Unread check message',
        message_type: 'text',
        status: 'sent',
      })
      .select('id')
      .single();

    if (textMessage.error || !textMessage.data?.id) {
      record('Unread increment', false, textMessage.error?.message ?? 'message insert failed');
      record('Mark read', false, 'message yok');
    } else {
      resources.messages.push(textMessage.data.id);

      const sellerUnread = await admin
        .from('conversation_participants')
        .select('unread_count')
        .eq('conversation_id', conversationId)
        .eq('user_id', seller.id)
        .single();

      const unreadCount = Number(sellerUnread.data?.unread_count ?? 0);
      record('Unread increment', unreadCount > 0, `seller_unread=${unreadCount}`);

      const seen = await seller.client.rpc('mark_conversation_seen_v2', {
        p_conversation_id: conversationId,
      });

      if (seen.error) {
        record('Mark read', false, seen.error.message);
      } else {
        const postUnread = await admin
          .from('conversation_participants')
          .select('unread_count')
          .eq('conversation_id', conversationId)
          .eq('user_id', seller.id)
          .single();

        const postUnreadCount = Number(postUnread.data?.unread_count ?? -1);
        record('Mark read', postUnreadCount === 0, `seller_unread=${postUnreadCount}`);
      }
    }
  }

  // 3) Typing
  {
    const typingOn = await buyer.client.rpc('set_conversation_typing', {
      p_conversation_id: conversationId,
      p_is_typing: true,
    });

    if (typingOn.error) {
      record('Typing on/off', false, typingOn.error.message);
    } else {
      const rowOn = await admin
        .from('conversation_typing')
        .select('is_typing')
        .eq('conversation_id', conversationId)
        .eq('user_id', buyer.id)
        .single();

      const typingOff = await buyer.client.rpc('set_conversation_typing', {
        p_conversation_id: conversationId,
        p_is_typing: false,
      });

      const rowOff = await admin
        .from('conversation_typing')
        .select('is_typing')
        .eq('conversation_id', conversationId)
        .eq('user_id', buyer.id)
        .single();

      const ok = !typingOff.error && rowOn.data?.is_typing === true && rowOff.data?.is_typing === false;
      const detail = typingOff.error?.message ?? `on=${String(rowOn.data?.is_typing)} off=${String(rowOff.data?.is_typing)}`;
      record('Typing on/off', ok, detail);
    }
  }

  // 4) Block
  {
    const block = await buyer.client
      .from('user_blocks')
      .insert({ blocker_id: buyer.id, blocked_id: seller.id, reason: 'chat smoke block' })
      .select('id')
      .single();

    if (block.error || !block.data?.id) {
      record('Block user', false, block.error?.message ?? 'insert failed');
    } else {
      resources.blocks.push(block.data.id);
      record('Block user', true, `block_id=${block.data.id}`);

      const blockedSend = await seller.client
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: seller.id,
          receiver_id: buyer.id,
          body: 'Should fail because blocked',
          text: 'Should fail because blocked',
          message_type: 'text',
          status: 'sent',
        })
        .select('id')
        .single();

      const blockedOk = Boolean(blockedSend.error);
      record('Block enforcement', blockedOk, blockedSend.error?.message ?? 'message unexpectedly inserted');

      if (blockedSend.data?.id) {
        resources.messages.push(blockedSend.data.id);
      }
    }
  }

  // 5) Report
  {
    const report = await buyer.client.rpc('submit_report', {
      p_target_type: 'user',
      p_target_id: seller.id,
      p_reason: 'chat-smoke',
      p_description: 'chat smoke report flow',
    });

    if (report.error || !report.data) {
      record('Report user', false, report.error?.message ?? 'rpc returned empty');
    } else {
      const reportId = String(report.data);
      resources.reports.push(reportId);

      const exists = await admin
        .from('reports')
        .select('id,status,target_type')
        .eq('id', reportId)
        .single();

      const ok = !exists.error && exists.data?.status === 'pending' && exists.data?.target_type === 'user';
      record('Report user', ok, exists.error?.message ?? `report_id=${reportId}`);
    }
  }

  const passCount = results.filter((item) => item.ok).length;
  const failCount = results.length - passCount;

  console.log('CHAT SMOKE RESULTS');
  for (const item of results) {
    const tag = item.ok ? 'PASS' : 'FAIL';
    console.log(`${tag} | ${item.name} | ${item.detail}`);
  }
  console.log(`SUMMARY | pass=${passCount} fail=${failCount}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(`CHAT SMOKE FAIL: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
