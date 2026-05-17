-- Quán Ăn Đồng Quê online schema
-- Run this in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('customer', 'staff', 'owner', 'shipper');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.menu_category as enum ('ga', 'vit', 'com', 'uong');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.menu_status as enum ('available', 'soldout', 'hidden');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'bank', 'momo', 'vnpay', 'preorder');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  public_code text unique,
  role public.app_role not null default 'customer',
  name text not null,
  phone text unique,
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id text primary key,
  name text not null,
  category public.menu_category not null,
  price integer not null check (price >= 0),
  description text not null default '',
  image_path text not null default 'assets/images/placeholder.svg',
  status public.menu_status not null default 'available',
  sold integer not null default 0 check (sold >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vouchers (
  code text primary key,
  type text not null check (type in ('percent', 'fixed')),
  value integer not null check (value >= 0),
  min_order integer not null default 0 check (min_order >= 0),
  description text not null default '',
  active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  source text,
  owner_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_vouchers (
  user_id uuid not null references public.profiles(id) on delete cascade,
  voucher_code text not null references public.vouchers(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, voucher_code)
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  menu_item_id text not null references public.menu_items(id),
  quantity integer not null check (quantity > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, menu_item_id, note)
);

create table if not exists public.orders (
  id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  staff_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  address text,
  note text not null default '',
  payment_method public.payment_method not null default 'cash',
  subtotal integer not null default 0 check (subtotal >= 0),
  discount integer not null default 0 check (discount >= 0),
  total integer not null default 0 check (total >= 0),
  voucher_code text references public.vouchers(code) on delete set null,
  source text not null default 'order',
  status text not null default 'paid',
  points_earned integer not null default 0 check (points_earned >= 0),
  points_awarded boolean not null default false,
  points_awarded_at timestamptz,
  delivered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  menu_item_id text references public.menu_items(id) on delete set null,
  name text not null,
  price integer not null check (price >= 0),
  quantity integer not null check (quantity > 0),
  note text not null default '',
  category public.menu_category,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  phone text not null,
  type text not null,
  item_name text,
  quantity integer not null default 1 check (quantity > 0),
  price integer not null default 0 check (price >= 0),
  total integer not null default 0 check (total >= 0),
  needed_date date not null,
  note text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_sequences (
  key text primary key,
  value integer not null default 0 check (value >= 0)
);

insert into public.app_sequences (key, value)
values ('order', 0), ('pos_order', 0), ('reservation', 0), ('customer_code', 0)
on conflict (key) do nothing;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists menu_items_touch_updated_at on public.menu_items;
create trigger menu_items_touch_updated_at before update on public.menu_items
for each row execute function public.touch_updated_at();

drop trigger if exists vouchers_touch_updated_at on public.vouchers;
create trigger vouchers_touch_updated_at before update on public.vouchers
for each row execute function public.touch_updated_at();

drop trigger if exists carts_touch_updated_at on public.carts;
create trigger carts_touch_updated_at before update on public.carts
for each row execute function public.touch_updated_at();

drop trigger if exists cart_items_touch_updated_at on public.cart_items;
create trigger cart_items_touch_updated_at before update on public.cart_items
for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders
for each row execute function public.touch_updated_at();

drop trigger if exists reservations_touch_updated_at on public.reservations;
create trigger reservations_touch_updated_at before update on public.reservations
for each row execute function public.touch_updated_at();

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('staff', 'owner'), false)
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'owner', false)
$$;

create or replace function public.next_public_code(prefix text, seq_key text, width integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value integer;
begin
  insert into public.app_sequences(key, value)
  values (seq_key, 0)
  on conflict (key) do nothing;

  update public.app_sequences
  set value = value + 1
  where key = seq_key
  returning value into next_value;

  return prefix || lpad(next_value::text, width, '0');
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_role public.app_role;
  desired_code text;
begin
  desired_role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'customer'::public.app_role);
  desired_code := new.raw_user_meta_data ->> 'public_code';

  if desired_code is null or desired_code = '' then
    if desired_role = 'staff' then
      desired_code := public.next_public_code('E', 'staff_code', 5);
    elsif desired_role = 'owner' then
      desired_code := public.next_public_code('A', 'owner_code', 5);
    elsif desired_role = 'shipper' then
      desired_code := public.next_public_code('D', 'shipper_code', 5);
    else
      desired_code := public.next_public_code('', 'customer_code', 6);
    end if;
  end if;

  insert into public.profiles (id, public_code, role, name, phone)
  values (
    new.id,
    desired_code,
    desired_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1), 'Khách hàng'),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.calculate_order_points(total_amount integer)
returns integer
language sql
immutable
as $$
  select greatest(floor(coalesce(total_amount, 0) / 10000), 0)::integer
$$;

create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.app_role;
  order_source text;
  order_id text;
  order_user_id uuid;
  order_staff_id uuid;
  order_total integer;
  order_points integer;
  item jsonb;
  created_order public.orders;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  actor_role := public.current_app_role();
  order_source := coalesce(nullif(payload ->> 'source', ''), 'order');
  order_id := payload ->> 'id';

  if order_id is null or order_id = '' then
    if order_source = 'pos' then
      order_id := public.next_public_code('POS-', 'pos_order', 4);
    else
      order_id := public.next_public_code('ORD-', 'order', 4);
    end if;
  end if;

  if order_source = 'pos' then
    if actor_role not in ('staff', 'owner') then
      raise exception 'Only staff or owner can create POS orders';
    end if;
    order_user_id := null;
    order_staff_id := auth.uid();
  else
    order_user_id := auth.uid();
    order_staff_id := null;
  end if;

  order_total := greatest(coalesce((payload ->> 'total')::integer, 0), 0);
  order_points := public.calculate_order_points(order_total);

  insert into public.orders (
    id,
    user_id,
    staff_id,
    customer_name,
    customer_phone,
    address,
    note,
    payment_method,
    subtotal,
    discount,
    total,
    voucher_code,
    source,
    status,
    points_earned,
    points_awarded,
    points_awarded_at
  )
  values (
    order_id,
    order_user_id,
    order_staff_id,
    coalesce(nullif(payload ->> 'customerName', ''), 'Khách hàng'),
    nullif(payload ->> 'customerPhone', ''),
    nullif(payload ->> 'address', ''),
    coalesce(payload ->> 'note', ''),
    coalesce(nullif(payload ->> 'paymentMethod', ''), 'cash')::public.payment_method,
    greatest(coalesce((payload ->> 'subtotal')::integer, 0), 0),
    greatest(coalesce((payload ->> 'discount')::integer, 0), 0),
    order_total,
    nullif(payload ->> 'voucherCode', ''),
    order_source,
    coalesce(nullif(payload ->> 'status', ''), 'paid'),
    order_points,
    false,
    null
  )
  returning * into created_order;

  for item in select * from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb))
  loop
    insert into public.order_items (
      order_id,
      menu_item_id,
      name,
      price,
      quantity,
      note,
      category
    )
    values (
      order_id,
      nullif(item ->> 'id', ''),
      coalesce(nullif(item ->> 'name', ''), 'Món'),
      greatest(coalesce((item ->> 'price')::integer, 0), 0),
      greatest(coalesce((item ->> 'qty')::integer, 1), 1),
      coalesce(item ->> 'note', ''),
      nullif(item ->> 'category', '')::public.menu_category
    );

    update public.menu_items
    set sold = sold + greatest(coalesce((item ->> 'qty')::integer, 1), 1)
    where id = nullif(item ->> 'id', '');
  end loop;

  return jsonb_build_object(
    'id', created_order.id,
    'userId', (select public_code from public.profiles where id = created_order.user_id),
    'customerName', created_order.customer_name,
    'customerPhone', created_order.customer_phone,
    'address', created_order.address,
    'note', created_order.note,
    'paymentMethod', created_order.payment_method,
    'subtotal', created_order.subtotal,
    'discount', created_order.discount,
    'total', created_order.total,
    'voucherCode', created_order.voucher_code,
    'source', created_order.source,
    'pointsEarned', created_order.points_earned,
    'pointsAwarded', created_order.points_awarded,
    'pointsAwardedAt', created_order.points_awarded_at,
    'status', created_order.status,
    'createdAt', created_order.created_at,
    'items', coalesce(payload -> 'items', '[]'::jsonb)
  );
end;
$$;

create or replace function public.update_order_status(order_id text, next_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.app_role;
  target public.orders;
  awarded_points integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  actor_role := public.current_app_role();

  select * into target
  from public.orders
  where id = order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if actor_role not in ('staff', 'owner', 'shipper') then
    raise exception 'Insufficient permission';
  end if;

  if actor_role = 'shipper' and target.status <> 'shipping' then
    raise exception 'Shipper can only update shipping orders';
  end if;

  update public.orders
  set
    status = next_status,
    delivered_by = case
      when actor_role = 'shipper' then auth.uid()
      else delivered_by
    end
  where id = order_id
  returning * into target;

  if next_status = 'delivered' and not target.points_awarded and target.user_id is not null then
    awarded_points := public.calculate_order_points(target.total);
    if awarded_points > 0 then
      update public.profiles
      set points = points + awarded_points
      where id = target.user_id;

      update public.orders
      set
        points_earned = awarded_points,
        points_awarded = true,
        points_awarded_at = now()
      where id = order_id
      returning * into target;
    end if;
  end if;

  return jsonb_build_object(
    'id', target.id,
    'status', target.status,
    'pointsEarned', target.points_earned,
    'pointsAwarded', target.points_awarded,
    'pointsAwardedAt', target.points_awarded_at,
    'updatedAt', target.updated_at
  );
end;
$$;

create or replace function public.create_reservation(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_id text;
  actor_role public.app_role;
  reservation_user_id uuid;
  created_reservation public.reservations;
begin
  actor_role := public.current_app_role();
  reservation_id := payload ->> 'id';
  if reservation_id is null or reservation_id = '' then
    reservation_id := public.next_public_code('RES-', 'reservation', 4);
  end if;

  if auth.uid() is not null and actor_role = 'customer' then
    reservation_user_id := auth.uid();
  else
    reservation_user_id := null;
  end if;

  insert into public.reservations (
    id,
    user_id,
    name,
    phone,
    type,
    item_name,
    quantity,
    price,
    total,
    needed_date,
    note,
    status
  )
  values (
    reservation_id,
    reservation_user_id,
    coalesce(nullif(payload ->> 'name', ''), 'Khách hàng'),
    coalesce(nullif(payload ->> 'phone', ''), ''),
    coalesce(nullif(payload ->> 'type', ''), 'preorder'),
    nullif(payload ->> 'itemName', ''),
    greatest(coalesce((payload ->> 'qty')::integer, 1), 1),
    greatest(coalesce((payload ->> 'price')::integer, 0), 0),
    greatest(coalesce((payload ->> 'total')::integer, 0), 0),
    (payload ->> 'date')::date,
    coalesce(payload ->> 'note', ''),
    coalesce(nullif(payload ->> 'status', ''), 'pending')
  )
  on conflict (id) do update set
    name = excluded.name,
    phone = excluded.phone,
    type = excluded.type,
    item_name = excluded.item_name,
    quantity = excluded.quantity,
    price = excluded.price,
    total = excluded.total,
    needed_date = excluded.needed_date,
    note = excluded.note,
    status = excluded.status
  returning * into created_reservation;

  return jsonb_build_object(
    'id', created_reservation.id,
    'userId', (select public_code from public.profiles where id = created_reservation.user_id),
    'name', created_reservation.name,
    'phone', created_reservation.phone,
    'type', created_reservation.type,
    'itemName', created_reservation.item_name,
    'qty', created_reservation.quantity,
    'price', created_reservation.price,
    'total', created_reservation.total,
    'date', created_reservation.needed_date,
    'note', created_reservation.note,
    'status', created_reservation.status,
    'createdAt', created_reservation.created_at
  );
end;
$$;

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_menu_items_category_status on public.menu_items(category, status);
create index if not exists idx_orders_user_created_at on public.orders(user_id, created_at desc);
create index if not exists idx_orders_status_created_at on public.orders(status, created_at desc);
create index if not exists idx_orders_source_created_at on public.orders(source, created_at desc);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_reservations_user_created_at on public.reservations(user_id, created_at desc);
create index if not exists idx_reservations_status_needed_date on public.reservations(status, needed_date);
create index if not exists idx_cart_items_cart_id on public.cart_items(cart_id);

alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.vouchers enable row level security;
alter table public.user_vouchers enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reservations enable row level security;
alter table public.app_sequences enable row level security;

drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id or public.is_staff_or_owner());

drop policy if exists "profiles_update_own_or_owner" on public.profiles;
create policy "profiles_update_own_or_owner"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id or public.is_owner())
with check ((select auth.uid()) = id or public.is_owner());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "menu_public_read_visible" on public.menu_items;
create policy "menu_public_read_visible"
on public.menu_items for select
to anon, authenticated
using (status <> 'hidden' or public.is_staff_or_owner());

drop policy if exists "menu_owner_write" on public.menu_items;
create policy "menu_owner_write"
on public.menu_items for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "vouchers_public_read_active" on public.vouchers;
create policy "vouchers_public_read_active"
on public.vouchers for select
to anon, authenticated
using (active = true or public.is_staff_or_owner());

drop policy if exists "vouchers_owner_write" on public.vouchers;
create policy "vouchers_owner_write"
on public.vouchers for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "user_vouchers_select_own_or_staff" on public.user_vouchers;
create policy "user_vouchers_select_own_or_staff"
on public.user_vouchers for select
to authenticated
using (user_id = (select auth.uid()) or public.is_staff_or_owner());

drop policy if exists "user_vouchers_insert_own_or_owner" on public.user_vouchers;
create policy "user_vouchers_insert_own_or_owner"
on public.user_vouchers for insert
to authenticated
with check (user_id = (select auth.uid()) or public.is_owner());

drop policy if exists "carts_own" on public.carts;
create policy "carts_own"
on public.carts for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "cart_items_own" on public.cart_items;
create policy "cart_items_own"
on public.cart_items for all
to authenticated
using (exists (
  select 1 from public.carts c
  where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.carts c
  where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
));

drop policy if exists "orders_select_own_staff_shipper" on public.orders;
create policy "orders_select_own_staff_shipper"
on public.orders for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_staff_or_owner()
  or (public.current_app_role() = 'shipper' and status in ('shipping', 'delivered', 'cancelled'))
);

drop policy if exists "orders_insert_customer_or_staff" on public.orders;
create policy "orders_insert_customer_or_staff"
on public.orders for insert
to authenticated
with check (user_id = (select auth.uid()) or public.is_staff_or_owner());

drop policy if exists "orders_update_staff_owner_shipper" on public.orders;
create policy "orders_update_staff_owner_shipper"
on public.orders for update
to authenticated
using (public.is_staff_or_owner() or public.current_app_role() = 'shipper')
with check (public.is_staff_or_owner() or public.current_app_role() = 'shipper');

drop policy if exists "order_items_select_by_order" on public.order_items;
create policy "order_items_select_by_order"
on public.order_items for select
to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
  and (
    o.user_id = (select auth.uid())
    or public.is_staff_or_owner()
    or (public.current_app_role() = 'shipper' and o.status in ('shipping', 'delivered', 'cancelled'))
  )
));

drop policy if exists "order_items_insert_customer_or_staff" on public.order_items;
create policy "order_items_insert_customer_or_staff"
on public.order_items for insert
to authenticated
with check (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
  and (o.user_id = (select auth.uid()) or public.is_staff_or_owner())
));

drop policy if exists "order_items_update_delete_by_order_owner_or_staff" on public.order_items;
create policy "order_items_update_delete_by_order_owner_or_staff"
on public.order_items for all
to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
  and (o.user_id = (select auth.uid()) or public.is_staff_or_owner())
))
with check (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id
  and (o.user_id = (select auth.uid()) or public.is_staff_or_owner())
));

drop policy if exists "reservations_select_own_or_staff" on public.reservations;
create policy "reservations_select_own_or_staff"
on public.reservations for select
to authenticated
using (user_id = (select auth.uid()) or public.is_staff_or_owner());

drop policy if exists "reservations_insert_customer_or_guest_staff" on public.reservations;
create policy "reservations_insert_customer_or_guest_staff"
on public.reservations for insert
to anon, authenticated
with check (user_id is null or user_id = (select auth.uid()) or public.is_staff_or_owner());

drop policy if exists "reservations_update_staff_owner" on public.reservations;
create policy "reservations_update_staff_owner"
on public.reservations for update
to authenticated
using (public.is_staff_or_owner())
with check (public.is_staff_or_owner());

drop policy if exists "app_sequences_owner_only" on public.app_sequences;
create policy "app_sequences_owner_only"
on public.app_sequences for all
to authenticated
using (public.is_owner())
with check (public.is_owner());
