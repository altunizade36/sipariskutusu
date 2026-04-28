-- Core marketplace schema for Siparis Kutusu
-- Run in Supabase SQL Editor after creating project.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  store_name text not null,
  username text not null unique,
  bio text,
  whatsapp_phone text,
  is_verified boolean not null default false,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'approved', 'rejected')),
  rating numeric(3,2) not null default 0,
  review_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null unique references public.seller_profiles (id) on delete cascade,
  instagram_user_id text,
  username text not null,
  is_business boolean not null default false,
  is_verified boolean not null default false,
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles (id) on delete cascade,
  title text not null,
  description text,
  brand text,
  category_slug text,
  price numeric(12,2) not null,
  compare_at_price numeric(12,2),
  stock integer not null default 0,
  currency text not null default 'TRY',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique(cart_id, product_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id),
  seller_id uuid not null references public.seller_profiles (id),
  status text not null default 'pending' check (status in ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'failed', 'refunded')),
  total_amount numeric(12,2) not null,
  currency text not null default 'TRY',
  shipping_address jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  product_title text not null,
  unit_price numeric(12,2) not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_name text,
  ip_address text,
  location text,
  risk_level text not null default 'trusted' check (risk_level in ('trusted', 'review')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  severity text not null default 'low' check (severity in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

-- updated_at triggers
create trigger set_profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger set_seller_profiles_updated_at before update on public.seller_profiles
for each row execute procedure public.set_updated_at();

create trigger set_instagram_accounts_updated_at before update on public.instagram_accounts
for each row execute procedure public.set_updated_at();

create trigger set_products_updated_at before update on public.products
for each row execute procedure public.set_updated_at();

create trigger set_carts_updated_at before update on public.carts
for each row execute procedure public.set_updated_at();

create trigger set_orders_updated_at before update on public.orders
for each row execute procedure public.set_updated_at();

create trigger set_conversations_updated_at before update on public.conversations
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.instagram_accounts enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.favorites enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.user_sessions enable row level security;
alter table public.security_events enable row level security;

-- Profiles
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

-- Seller profiles and linked instagram
create policy "seller_profiles_select_public" on public.seller_profiles
for select using (true);

create policy "seller_profiles_manage_own" on public.seller_profiles
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "instagram_accounts_manage_own" on public.instagram_accounts
for all using (
  exists (
    select 1
    from public.seller_profiles sp
    where sp.id = instagram_accounts.seller_id
      and sp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.seller_profiles sp
    where sp.id = instagram_accounts.seller_id
      and sp.user_id = auth.uid()
  )
);

-- Products are public read, seller own write
create policy "products_read_public" on public.products
for select using (status = 'active' or exists (
  select 1 from public.seller_profiles sp where sp.id = products.seller_id and sp.user_id = auth.uid()
));

create policy "products_manage_own" on public.products
for all using (
  exists (
    select 1
    from public.seller_profiles sp
    where sp.id = products.seller_id
      and sp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.seller_profiles sp
    where sp.id = products.seller_id
      and sp.user_id = auth.uid()
  )
);

create policy "product_images_read_public" on public.product_images
for select using (true);

create policy "product_images_manage_owner" on public.product_images
for all using (
  exists (
    select 1
    from public.products p
    join public.seller_profiles sp on sp.id = p.seller_id
    where p.id = product_images.product_id
      and sp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.products p
    join public.seller_profiles sp on sp.id = p.seller_id
    where p.id = product_images.product_id
      and sp.user_id = auth.uid()
  )
);

-- Cart/Favorites only own
create policy "carts_manage_own" on public.carts
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "cart_items_manage_own" on public.cart_items
for all using (
  exists (
    select 1
    from public.carts c
    where c.id = cart_items.cart_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.carts c
    where c.id = cart_items.cart_id
      and c.user_id = auth.uid()
  )
);

create policy "favorites_manage_own" on public.favorites
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Orders visible to buyer and seller owner
create policy "orders_read_participants" on public.orders
for select using (
  auth.uid() = buyer_id or
  exists (
    select 1 from public.seller_profiles sp
    where sp.id = orders.seller_id
      and sp.user_id = auth.uid()
  )
);

create policy "orders_create_buyer" on public.orders
for insert with check (auth.uid() = buyer_id);

create policy "orders_update_participants" on public.orders
for update using (
  auth.uid() = buyer_id or
  exists (
    select 1 from public.seller_profiles sp
    where sp.id = orders.seller_id
      and sp.user_id = auth.uid()
  )
);

create policy "order_items_read_participants" on public.order_items
for select using (
  exists (
    select 1
    from public.orders o
    left join public.seller_profiles sp on sp.id = o.seller_id
    where o.id = order_items.order_id
      and (o.buyer_id = auth.uid() or sp.user_id = auth.uid())
  )
);

-- Messaging: conversation members only
create policy "conversations_read_member" on public.conversations
for select using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversations.id
      and cm.user_id = auth.uid()
  )
);

create policy "conversations_insert_member" on public.conversations
for insert with check (
  exists (
    select 1 from public.seller_profiles sp
    where sp.id = conversations.seller_id
      and sp.user_id = auth.uid()
  )
);

create policy "conversation_members_read_own" on public.conversation_members
for select using (user_id = auth.uid());

create policy "conversation_members_insert_own" on public.conversation_members
for insert with check (user_id = auth.uid());

create policy "messages_read_member" on public.messages
for select using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

create policy "messages_insert_member" on public.messages
for insert with check (
  auth.uid() = sender_id and
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

-- User sessions and security events: own only
create policy "user_sessions_manage_own" on public.user_sessions
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "security_events_read_own" on public.security_events
for select using (auth.uid() = user_id);

create policy "security_events_insert_own" on public.security_events
for insert with check (auth.uid() = user_id);

  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversations.id
      and cm.user_id = auth.uid()
  )
);

create policy "conversation_members_read_member" on public.conversation_members
for select using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversation_members.conversation_id
      and cm.user_id = auth.uid()
  )
);

create policy "messages_read_member" on public.messages
for select using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

create policy "messages_send_member" on public.messages
for insert with check (
  auth.uid() = sender_id and
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

-- Security tables
create policy "user_sessions_manage_own" on public.user_sessions
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "security_events_read_own" on public.security_events
for select using (auth.uid() = user_id);

create policy "security_events_insert_own" on public.security_events
for insert with check (auth.uid() = user_id);
