-- Quán Ăn Đồng Quê online schema
-- Run this in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('customer', 'staff', 'owner', 'shipper');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.menu_category as enum ('ga', 'vit', 'bun', 'mien', 'chao', 'kho');
exception
  when duplicate_object then
    alter type public.menu_category add value if not exists 'bun';
    alter type public.menu_category add value if not exists 'mien';
    alter type public.menu_category add value if not exists 'chao';
    alter type public.menu_category add value if not exists 'kho';
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  name text not null,
  phone text unique,
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  name text not null,
  phone text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.owner_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  name text not null,
  phone text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipper_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  name text not null,
  phone text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'name'
  ) then
    insert into public.customer_profiles (id, name, phone, points, created_at, updated_at)
    select id, name, phone, points, created_at, updated_at
    from public.profiles
    where role = 'customer'
    on conflict (id) do nothing;

    insert into public.staff_profiles (id, name, phone, created_at, updated_at)
    select id, name, phone, created_at, updated_at
    from public.profiles
    where role = 'staff'
    on conflict (id) do nothing;

    insert into public.owner_profiles (id, name, phone, created_at, updated_at)
    select id, name, phone, created_at, updated_at
    from public.profiles
    where role = 'owner'
    on conflict (id) do nothing;

    insert into public.shipper_profiles (id, name, phone, created_at, updated_at)
    select id, name, phone, created_at, updated_at
    from public.profiles
    where role = 'shipper'
    on conflict (id) do nothing;
  end if;
end $$;

alter table public.profiles
  drop column if exists name,
  drop column if exists phone,
  drop column if exists points;

create or replace view public.profile_details
with (security_invoker = true)
as
select
  p.id,
  p.public_code,
  p.role,
  coalesce(cp.name, sp.name, op.name, shp.name, '') as name,
  coalesce(cp.phone, sp.phone, op.phone, shp.phone) as phone,
  coalesce(cp.points, 0) as points,
  p.created_at,
  p.updated_at
from public.profiles p
left join public.customer_profiles cp on cp.id = p.id and p.role = 'customer'
left join public.staff_profiles sp on sp.id = p.id and p.role = 'staff'
left join public.owner_profiles op on op.id = p.id and p.role = 'owner'
left join public.shipper_profiles shp on shp.id = p.id and p.role = 'shipper';

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
  status text not null default 'pending',
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

create table if not exists public.pos_orders (
  id text primary key,
  staff_id uuid references public.profiles(id) on delete set null,
  customer_name text not null default 'Khách tại quán',
  customer_phone text,
  note text not null default '',
  payment_method public.payment_method not null default 'cash',
  subtotal integer not null default 0 check (subtotal >= 0),
  discount integer not null default 0 check (discount >= 0),
  total integer not null default 0 check (total >= 0),
  status text not null default 'completed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pos_order_items (
  id uuid primary key default gen_random_uuid(),
  pos_order_id text not null references public.pos_orders(id) on delete cascade,
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
  staff_id uuid references public.profiles(id) on delete set null,
  staff_created boolean not null default false,
  points_earned integer not null default 0 check (points_earned >= 0),
  points_awarded boolean not null default false,
  points_awarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_sequences (
  key text primary key,
  value integer not null default 0 check (value >= 0)
);

insert into public.app_sequences (key, value)
values
  ('order', 0),
  ('pos_order', 0),
  ('reservation', 0),
  ('customer_code', 0),
  ('staff_code', 0),
  ('owner_code', 0),
  ('shipper_code', 0)
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

drop trigger if exists customer_profiles_touch_updated_at on public.customer_profiles;
create trigger customer_profiles_touch_updated_at before update on public.customer_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists staff_profiles_touch_updated_at on public.staff_profiles;
create trigger staff_profiles_touch_updated_at before update on public.staff_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists owner_profiles_touch_updated_at on public.owner_profiles;
create trigger owner_profiles_touch_updated_at before update on public.owner_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists shipper_profiles_touch_updated_at on public.shipper_profiles;
create trigger shipper_profiles_touch_updated_at before update on public.shipper_profiles
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

drop trigger if exists pos_orders_touch_updated_at on public.pos_orders;
create trigger pos_orders_touch_updated_at before update on public.pos_orders
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
  candidate text;
begin
  insert into public.app_sequences(key, value)
  values (seq_key, 0)
  on conflict (key) do nothing;

  loop
    update public.app_sequences
    set value = value + 1
    where key = seq_key
    returning value into next_value;

    candidate := prefix || lpad(next_value::text, width, '0');

    exit when
      (prefix in ('KH', 'NV', 'CH', 'SP') and not exists (
        select 1 from public.profiles where public_code = candidate
      ))
      or (prefix = 'ORD-' and not exists (
        select 1 from public.orders where id = candidate
      ))
      or (prefix = 'POS-' and not exists (
        select 1 from public.pos_orders where id = candidate
      ))
      or (prefix = 'RES-' and not exists (
        select 1 from public.reservations where id = candidate
      ))
      or prefix not in ('KH', 'NV', 'CH', 'SP', 'ORD-', 'POS-', 'RES-');
  end loop;

  return candidate;
end;
$$;

create or replace function public.redeem_points_for_voucher(voucher_amount integer)
returns table (
  code text,
  type text,
  value integer,
  min_order integer,
  description text,
  active boolean,
  starts_at timestamptz,
  expires_at timestamptz,
  source text,
  owner_user_id uuid,
  created_at timestamptz,
  points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  customer_row public.customer_profiles%rowtype;
  required_points integer;
  voucher_code text;
  remaining_points integer;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập để đổi voucher.';
  end if;

  if voucher_amount is null or voucher_amount <= 0 or voucher_amount % 1000 <> 0 then
    raise exception 'Mệnh giá voucher phải là bội số của 1.000đ.';
  end if;

  required_points := voucher_amount / 1000;

  select id
  into profile_id
  from public.profiles
  where id = auth.uid()
    and role = 'customer';

  if not found then
    raise exception 'Không tìm thấy tài khoản khách hàng.';
  end if;

  select *
  into customer_row
  from public.customer_profiles
  where id = profile_id
  for update;

  if not found then
    raise exception 'Không tìm thấy tài khoản khách hàng.';
  end if;

  if customer_row.points < required_points then
    raise exception 'Bạn không đủ điểm để đổi voucher.';
  end if;

  loop
    voucher_code := 'RW' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.vouchers existing where existing.code = voucher_code);
  end loop;

  insert into public.vouchers (
    code, type, value, min_order, description, active, source, owner_user_id
  )
  values (
    voucher_code,
    'fixed',
    voucher_amount,
    0,
    'Voucher đổi từ ' || required_points::text || ' điểm thưởng',
    true,
    'rewards',
    customer_row.id
  );

  insert into public.user_vouchers (user_id, voucher_code)
  values (customer_row.id, voucher_code);

  update public.customer_profiles
  set points = points - required_points
  where id = customer_row.id
  returning public.customer_profiles.points into remaining_points;

  return query
  select
    v.code,
    v.type,
    v.value,
    v.min_order,
    v.description,
    v.active,
    v.starts_at,
    v.expires_at,
    v.source,
    v.owner_user_id,
    v.created_at,
    remaining_points
  from public.vouchers v
  where v.code = voucher_code;
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
  desired_name text;
  desired_phone text;
begin
  desired_role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'customer'::public.app_role);
  desired_code := new.raw_user_meta_data ->> 'public_code';
  desired_name := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1), 'Khách hàng');
  desired_phone := nullif(new.raw_user_meta_data ->> 'phone', '');

  if desired_code is null or desired_code = '' then
    if desired_role = 'staff' then
      desired_code := public.next_public_code('NV', 'staff_code', 5);
    elsif desired_role = 'owner' then
      desired_code := public.next_public_code('CH', 'owner_code', 5);
    elsif desired_role = 'shipper' then
      desired_code := public.next_public_code('SP', 'shipper_code', 5);
    else
      desired_code := public.next_public_code('KH', 'customer_code', 5);
    end if;
  end if;

  insert into public.profiles (id, public_code, role)
  values (
    new.id,
    desired_code,
    desired_role
  )
  on conflict (id) do nothing;

  if desired_role = 'staff' then
    insert into public.staff_profiles (id, name, phone)
    values (new.id, desired_name, desired_phone)
    on conflict (id) do nothing;
  elsif desired_role = 'owner' then
    insert into public.owner_profiles (id, name, phone)
    values (new.id, desired_name, desired_phone)
    on conflict (id) do nothing;
  elsif desired_role = 'shipper' then
    insert into public.shipper_profiles (id, name, phone)
    values (new.id, desired_name, desired_phone)
    on conflict (id) do nothing;
  else
    insert into public.customer_profiles (id, name, phone, points)
    values (new.id, desired_name, desired_phone, 0)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.normalize_phone(raw_phone text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g')
$$;

create or replace function public.phone_auth_email(raw_phone text)
returns text
language sql
immutable
as $$
  select public.normalize_phone(raw_phone) || '@phone.dongque.app'
$$;

create or replace function public.actor_profile_json(actor_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.public_code,
    'authId', p.id,
    'name', d.name,
    'phone', d.phone,
    'role', p.role,
    'createdAt', p.created_at
  )
  from public.profiles p
  join public.profile_details d on d.id = p.id
  where p.id = actor_id
$$;

create or replace function public.owner_create_actor_user(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_role public.app_role;
  actor_id uuid := gen_random_uuid();
  actor_name text;
  actor_phone text;
  actor_password text;
  actor_email text;
  actor_code text;
begin
  if not public.is_owner() then
    raise exception 'Only owner can create staff users';
  end if;

  actor_role := coalesce(nullif(payload ->> 'role', '')::public.app_role, 'staff'::public.app_role);
  if actor_role not in ('staff', 'shipper') then
    raise exception 'Role must be staff or shipper';
  end if;

  actor_name := coalesce(nullif(payload ->> 'name', ''), 'Nhân viên');
  actor_phone := public.normalize_phone(payload ->> 'phone');
  actor_password := coalesce(nullif(payload ->> 'password', ''), '');
  if actor_phone = '' then
    raise exception 'Số điện thoại không hợp lệ.';
  end if;
  if length(actor_password) < 6 then
    raise exception 'Mật khẩu phải có ít nhất 6 ký tự.';
  end if;

  actor_email := public.phone_auth_email(actor_phone);
  if exists (select 1 from auth.users where email = actor_email) then
    raise exception 'Số điện thoại đã được sử dụng.';
  end if;

  actor_code := case
    when actor_role = 'shipper' then public.next_public_code('SP', 'shipper_code', 5)
    else public.next_public_code('NV', 'staff_code', 5)
  end;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    actor_id,
    'authenticated',
    'authenticated',
    actor_email,
    crypt(actor_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('name', actor_name, 'phone', actor_phone, 'role', actor_role, 'public_code', actor_code),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    actor_id,
    actor_id::text,
    jsonb_build_object('sub', actor_id::text, 'email', actor_email, 'email_verified', true, 'phone', actor_phone),
    'email',
    now(),
    now(),
    now()
  );

  insert into public.profiles (id, public_code, role)
  values (actor_id, actor_code, actor_role)
  on conflict (id) do update set
    public_code = excluded.public_code,
    role = excluded.role;

  if actor_role = 'shipper' then
    insert into public.shipper_profiles (id, name, phone)
    values (actor_id, actor_name, actor_phone)
    on conflict (id) do update set name = excluded.name, phone = excluded.phone;
  else
    insert into public.staff_profiles (id, name, phone)
    values (actor_id, actor_name, actor_phone)
    on conflict (id) do update set name = excluded.name, phone = excluded.phone;
  end if;

  return public.actor_profile_json(actor_id);
end;
$$;

create or replace function public.owner_create_customer_user(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  customer_id uuid := gen_random_uuid();
  customer_name text;
  customer_phone text;
  customer_password text;
  customer_email text;
  customer_code text;
  customer_points integer;
begin
  if not public.is_owner() then
    raise exception 'Only owner can create customers';
  end if;

  customer_name := coalesce(nullif(payload ->> 'name', ''), 'Khách hàng');
  customer_phone := public.normalize_phone(payload ->> 'phone');
  customer_password := coalesce(nullif(payload ->> 'password', ''), '');
  customer_points := greatest(coalesce((payload ->> 'points')::integer, 0), 0);

  if customer_phone = '' then
    raise exception 'Số điện thoại không hợp lệ.';
  end if;
  if length(customer_password) < 6 then
    raise exception 'Mật khẩu phải có ít nhất 6 ký tự.';
  end if;

  customer_email := public.phone_auth_email(customer_phone);
  if exists (select 1 from auth.users where email = customer_email) then
    raise exception 'Số điện thoại đã được sử dụng.';
  end if;

  customer_code := public.next_public_code('KH', 'customer_code', 5);

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    customer_id,
    'authenticated',
    'authenticated',
    customer_email,
    crypt(customer_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('name', customer_name, 'phone', customer_phone, 'role', 'customer', 'public_code', customer_code),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    customer_id,
    customer_id::text,
    jsonb_build_object('sub', customer_id::text, 'email', customer_email, 'email_verified', true, 'phone', customer_phone),
    'email',
    now(),
    now(),
    now()
  );

  insert into public.profiles (id, public_code, role)
  values (customer_id, customer_code, 'customer')
  on conflict (id) do update set
    public_code = excluded.public_code,
    role = excluded.role;

  insert into public.customer_profiles (id, name, phone, points)
  values (customer_id, customer_name, customer_phone, customer_points)
  on conflict (id) do update set
    name = excluded.name,
    phone = excluded.phone,
    points = excluded.points;

  return public.actor_profile_json(customer_id);
end;
$$;

create or replace function public.owner_update_actor_user(actor_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_role public.app_role;
  next_role public.app_role;
  actor_name text;
  actor_phone text;
  actor_password text;
  actor_email text;
  next_code text;
begin
  if not public.is_owner() then
    raise exception 'Only owner can update staff users';
  end if;

  select role into current_role from public.profiles where id = actor_id for update;
  if not found or current_role not in ('staff', 'shipper') then
    raise exception 'Không tìm thấy nhân viên.';
  end if;

  next_role := coalesce(nullif(payload ->> 'role', '')::public.app_role, current_role);
  if next_role not in ('staff', 'shipper') then
    raise exception 'Role must be staff or shipper';
  end if;

  actor_name := coalesce(nullif(payload ->> 'name', ''), 'Nhân viên');
  actor_phone := public.normalize_phone(payload ->> 'phone');
  actor_password := coalesce(nullif(payload ->> 'password', ''), '');
  if actor_phone = '' then
    raise exception 'Số điện thoại không hợp lệ.';
  end if;
  actor_email := public.phone_auth_email(actor_phone);

  if exists (select 1 from auth.users where email = actor_email and id <> actor_id) then
    raise exception 'Số điện thoại đã được sử dụng.';
  end if;

  if next_role <> current_role then
    next_code := case
      when next_role = 'shipper' then public.next_public_code('SP', 'shipper_code', 5)
      else public.next_public_code('NV', 'staff_code', 5)
    end;
    update public.profiles set role = next_role, public_code = next_code where id = actor_id;
    delete from public.staff_profiles where id = actor_id;
    delete from public.shipper_profiles where id = actor_id;
  end if;

  if next_role = 'shipper' then
    insert into public.shipper_profiles (id, name, phone)
    values (actor_id, actor_name, actor_phone)
    on conflict (id) do update set name = excluded.name, phone = excluded.phone;
  else
    insert into public.staff_profiles (id, name, phone)
    values (actor_id, actor_name, actor_phone)
    on conflict (id) do update set name = excluded.name, phone = excluded.phone;
  end if;

  update auth.users
  set
    email = actor_email,
    raw_user_meta_data = jsonb_build_object('name', actor_name, 'phone', actor_phone, 'role', next_role),
    encrypted_password = case
      when actor_password <> '' then crypt(actor_password, gen_salt('bf'))
      else encrypted_password
    end,
    updated_at = now()
  where id = actor_id;

  update auth.identities
  set
    identity_data = jsonb_build_object('sub', actor_id::text, 'email', actor_email, 'email_verified', true, 'phone', actor_phone),
    updated_at = now()
  where user_id = actor_id and provider = 'email';

  return public.actor_profile_json(actor_id);
end;
$$;

create or replace function public.owner_delete_actor_user(actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_role public.app_role;
  actor_row jsonb;
begin
  if not public.is_owner() then
    raise exception 'Only owner can delete staff users';
  end if;

  select role into actor_role from public.profiles where id = actor_id;
  if not found or actor_role not in ('staff', 'shipper') then
    raise exception 'Không tìm thấy nhân viên.';
  end if;

  actor_row := public.actor_profile_json(actor_id);
  delete from auth.users where id = actor_id;
  return actor_row;
end;
$$;

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
  order_id text;
  order_total integer;
  order_points integer;
  requested_voucher text;
  is_reward_voucher boolean := false;
  item jsonb;
  created_order public.orders;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  actor_role := public.current_app_role();
  order_id := payload ->> 'id';

  if order_id is null or order_id = '' then
    order_id := public.next_public_code('ORD-', 'order', 4);
  end if;

  order_total := greatest(coalesce((payload ->> 'total')::integer, 0), 0);
  order_points := public.calculate_order_points(order_total);
  requested_voucher := nullif(payload ->> 'voucherCode', '');
  if requested_voucher is not null then
    select exists (
      select 1
      from public.vouchers v
      where v.code = requested_voucher
        and (v.source = 'rewards' or v.owner_user_id is not null)
    ) into is_reward_voucher;
  end if;

  if requested_voucher is not null and is_reward_voucher and not exists (
    select 1
    from public.user_vouchers uv
    where uv.user_id = auth.uid() and uv.voucher_code = requested_voucher
  ) then
    raise exception 'Voucher này chỉ dùng được cho tài khoản đã đổi.';
  end if;

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
    auth.uid(),
    null,
    coalesce(nullif(payload ->> 'customerName', ''), 'Khách hàng'),
    nullif(payload ->> 'customerPhone', ''),
    nullif(payload ->> 'address', ''),
    coalesce(payload ->> 'note', ''),
    coalesce(nullif(payload ->> 'paymentMethod', ''), 'cash')::public.payment_method,
    greatest(coalesce((payload ->> 'subtotal')::integer, 0), 0),
    greatest(coalesce((payload ->> 'discount')::integer, 0), 0),
    order_total,
    requested_voucher,
    'order',
    coalesce(nullif(payload ->> 'status', ''), 'pending'),
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

  if requested_voucher is not null and is_reward_voucher then
    delete from public.user_vouchers
    where user_id = auth.uid() and voucher_code = requested_voucher;

    delete from public.vouchers
    where code = requested_voucher
      and (source = 'rewards' or owner_user_id = auth.uid());
  end if;

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

create or replace function public.create_pos_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.app_role;
  order_id text;
  order_total integer;
  item jsonb;
  created_order public.pos_orders;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  actor_role := public.current_app_role();
  if actor_role not in ('staff', 'owner') then
    raise exception 'Only staff or owner can create POS orders';
  end if;

  order_id := payload ->> 'id';
  if order_id is null or order_id = '' then
    order_id := public.next_public_code('POS-', 'pos_order', 4);
  end if;

  order_total := greatest(coalesce((payload ->> 'total')::integer, 0), 0);

  insert into public.pos_orders (
    id,
    staff_id,
    customer_name,
    customer_phone,
    note,
    payment_method,
    subtotal,
    discount,
    total,
    status
  )
  values (
    order_id,
    auth.uid(),
    coalesce(nullif(payload ->> 'customerName', ''), 'Khách tại quán'),
    nullif(payload ->> 'customerPhone', ''),
    coalesce(payload ->> 'note', ''),
    coalesce(nullif(payload ->> 'paymentMethod', ''), 'cash')::public.payment_method,
    greatest(coalesce((payload ->> 'subtotal')::integer, 0), 0),
    greatest(coalesce((payload ->> 'discount')::integer, 0), 0),
    order_total,
    coalesce(nullif(payload ->> 'status', ''), 'completed')
  )
  returning * into created_order;

  for item in select * from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb))
  loop
    insert into public.pos_order_items (
      pos_order_id,
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
    'userId', null,
    'customerName', created_order.customer_name,
    'customerPhone', created_order.customer_phone,
    'address', 'Tại quán',
    'note', created_order.note,
    'paymentMethod', created_order.payment_method,
    'subtotal', created_order.subtotal,
    'discount', created_order.discount,
    'total', created_order.total,
    'voucherCode', null,
    'source', 'pos',
    'pointsEarned', 0,
    'pointsAwarded', false,
    'pointsAwardedAt', null,
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

  if actor_role = 'shipper' and (
    not (
      (target.status = 'ready' and next_status = 'delivering')
      or (target.status = 'delivering' and next_status in ('completed', 'cancelled'))
    )
  ) then
    raise exception 'Shipper can only receive ready orders or finish delivering orders';
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

  if next_status = 'completed' and not target.points_awarded and target.user_id is not null then
    awarded_points := public.calculate_order_points(target.total);
    if awarded_points > 0 then
      update public.customer_profiles
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
    'deliveredBy', (select public_code from public.profiles where id = target.delivered_by),
    'updatedAt', target.updated_at
  );
end;
$$;

create or replace function public.update_pos_order_status(order_id text, next_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.app_role;
  target public.pos_orders;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  actor_role := public.current_app_role();
  if actor_role not in ('staff', 'owner') then
    raise exception 'Only staff or owner can update POS orders';
  end if;

  select * into target
  from public.pos_orders
  where id = order_id
  for update;

  if not found then
    raise exception 'POS order not found';
  end if;

  if target.status = 'cancelled' or next_status not in ('completed', 'cancelled') then
    raise exception 'Invalid POS status update';
  end if;

  update public.pos_orders
  set status = next_status
  where id = order_id
  returning * into target;

  return jsonb_build_object(
    'id', target.id,
    'status', target.status,
    'pointsEarned', 0,
    'pointsAwarded', false,
    'pointsAwardedAt', null,
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
  reservation_staff_id uuid;
  reservation_staff_created boolean;
  reservation_total integer;
  created_reservation public.reservations;
begin
  actor_role := public.current_app_role();
  reservation_id := payload ->> 'id';
  if reservation_id is null or reservation_id = '' then
    reservation_id := public.next_public_code('RES-', 'reservation', 4);
  end if;

  if auth.uid() is not null and actor_role = 'customer' then
    reservation_user_id := auth.uid();
    reservation_staff_id := null;
    reservation_staff_created := false;
  elsif auth.uid() is not null and actor_role in ('staff', 'owner') then
    reservation_user_id := null;
    reservation_staff_id := auth.uid();
    reservation_staff_created := true;
  else
    reservation_user_id := null;
    reservation_staff_id := null;
    reservation_staff_created := false;
  end if;

  reservation_total := greatest(coalesce((payload ->> 'total')::integer, 0), 0);

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
    status,
    staff_id,
    staff_created,
    points_earned
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
    reservation_total,
    (payload ->> 'date')::date,
    coalesce(payload ->> 'note', ''),
    coalesce(nullif(payload ->> 'status', ''), 'pending'),
    reservation_staff_id,
    reservation_staff_created,
    case when reservation_staff_created then 0 else public.calculate_order_points(reservation_total) end
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
    status = excluded.status,
    staff_id = excluded.staff_id,
    staff_created = excluded.staff_created,
    points_earned = excluded.points_earned
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
    'staffCreated', created_reservation.staff_created,
    'pointsEarned', created_reservation.points_earned,
    'pointsAwarded', created_reservation.points_awarded,
    'pointsAwardedAt', created_reservation.points_awarded_at,
    'createdAt', created_reservation.created_at
  );
end;
$$;

create or replace function public.update_reservation_status(reservation_id text, next_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.app_role;
  target public.reservations;
  awarded_points integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  actor_role := public.current_app_role();
  if actor_role not in ('staff', 'owner') then
    raise exception 'Insufficient permission';
  end if;

  select * into target
  from public.reservations
  where id = reservation_id
  for update;

  if not found then
    raise exception 'Reservation not found';
  end if;

  update public.reservations
  set status = next_status
  where id = reservation_id
  returning * into target;

  if next_status = 'completed'
    and not target.staff_created
    and not target.points_awarded
    and target.user_id is not null then
    awarded_points := public.calculate_order_points(target.total);
    if awarded_points > 0 then
      update public.customer_profiles
      set points = points + awarded_points
      where id = target.user_id;

      update public.reservations
      set
        points_earned = awarded_points,
        points_awarded = true,
        points_awarded_at = now()
      where id = reservation_id
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

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_customer_profiles_phone on public.customer_profiles(phone);
create index if not exists idx_staff_profiles_phone on public.staff_profiles(phone);
create index if not exists idx_owner_profiles_phone on public.owner_profiles(phone);
create index if not exists idx_shipper_profiles_phone on public.shipper_profiles(phone);
create index if not exists idx_menu_items_category_status on public.menu_items(category, status);
create index if not exists idx_orders_user_created_at on public.orders(user_id, created_at desc);
create index if not exists idx_orders_status_created_at on public.orders(status, created_at desc);
create index if not exists idx_orders_source_created_at on public.orders(source, created_at desc);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_pos_orders_status_created_at on public.pos_orders(status, created_at desc);
create index if not exists idx_pos_order_items_order_id on public.pos_order_items(pos_order_id);
create index if not exists idx_reservations_user_created_at on public.reservations(user_id, created_at desc);
create index if not exists idx_reservations_status_needed_date on public.reservations(status, needed_date);
create index if not exists idx_cart_items_cart_id on public.cart_items(cart_id);

alter table public.profiles enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.owner_profiles enable row level security;
alter table public.shipper_profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.vouchers enable row level security;
alter table public.user_vouchers enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.pos_orders enable row level security;
alter table public.pos_order_items enable row level security;
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

drop policy if exists "profiles_delete_owner" on public.profiles;
create policy "profiles_delete_owner"
on public.profiles for delete
to authenticated
using (public.is_owner() and role = 'customer');

drop policy if exists "customer_profiles_select_own_or_staff" on public.customer_profiles;
create policy "customer_profiles_select_own_or_staff"
on public.customer_profiles for select
to authenticated
using ((select auth.uid()) = id or public.is_staff_or_owner());

drop policy if exists "customer_profiles_insert_own_or_owner" on public.customer_profiles;
create policy "customer_profiles_insert_own_or_owner"
on public.customer_profiles for insert
to authenticated
with check ((select auth.uid()) = id or public.is_owner());

drop policy if exists "customer_profiles_update_own_or_owner" on public.customer_profiles;
create policy "customer_profiles_update_own_or_owner"
on public.customer_profiles for update
to authenticated
using ((select auth.uid()) = id or public.is_owner())
with check ((select auth.uid()) = id or public.is_owner());

drop policy if exists "customer_profiles_delete_owner" on public.customer_profiles;
create policy "customer_profiles_delete_owner"
on public.customer_profiles for delete
to authenticated
using (public.is_owner());

drop policy if exists "staff_profiles_select_own_or_staff" on public.staff_profiles;
create policy "staff_profiles_select_own_or_staff"
on public.staff_profiles for select
to authenticated
using ((select auth.uid()) = id or public.is_staff_or_owner());

drop policy if exists "staff_profiles_insert_own_or_owner" on public.staff_profiles;
create policy "staff_profiles_insert_own_or_owner"
on public.staff_profiles for insert
to authenticated
with check ((select auth.uid()) = id or public.is_owner());

drop policy if exists "staff_profiles_update_own_or_owner" on public.staff_profiles;
create policy "staff_profiles_update_own_or_owner"
on public.staff_profiles for update
to authenticated
using ((select auth.uid()) = id or public.is_owner())
with check ((select auth.uid()) = id or public.is_owner());

drop policy if exists "staff_profiles_delete_owner" on public.staff_profiles;
create policy "staff_profiles_delete_owner"
on public.staff_profiles for delete
to authenticated
using (public.is_owner());

drop policy if exists "owner_profiles_select_own_or_staff" on public.owner_profiles;
create policy "owner_profiles_select_own_or_staff"
on public.owner_profiles for select
to authenticated
using ((select auth.uid()) = id or public.is_staff_or_owner());

drop policy if exists "owner_profiles_insert_owner" on public.owner_profiles;
create policy "owner_profiles_insert_owner"
on public.owner_profiles for insert
to authenticated
with check (public.is_owner());

drop policy if exists "owner_profiles_update_own_or_owner" on public.owner_profiles;
create policy "owner_profiles_update_own_or_owner"
on public.owner_profiles for update
to authenticated
using ((select auth.uid()) = id or public.is_owner())
with check ((select auth.uid()) = id or public.is_owner());

drop policy if exists "owner_profiles_delete_owner" on public.owner_profiles;
create policy "owner_profiles_delete_owner"
on public.owner_profiles for delete
to authenticated
using (public.is_owner());

drop policy if exists "shipper_profiles_select_own_or_staff" on public.shipper_profiles;
create policy "shipper_profiles_select_own_or_staff"
on public.shipper_profiles for select
to authenticated
using ((select auth.uid()) = id or public.is_staff_or_owner());

drop policy if exists "shipper_profiles_insert_own_or_owner" on public.shipper_profiles;
create policy "shipper_profiles_insert_own_or_owner"
on public.shipper_profiles for insert
to authenticated
with check ((select auth.uid()) = id or public.is_owner());

drop policy if exists "shipper_profiles_update_own_or_owner" on public.shipper_profiles;
create policy "shipper_profiles_update_own_or_owner"
on public.shipper_profiles for update
to authenticated
using ((select auth.uid()) = id or public.is_owner())
with check ((select auth.uid()) = id or public.is_owner());

drop policy if exists "shipper_profiles_delete_owner" on public.shipper_profiles;
create policy "shipper_profiles_delete_owner"
on public.shipper_profiles for delete
to authenticated
using (public.is_owner());

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
using (
  public.is_staff_or_owner()
  or (
    active = true
    and (
      (coalesce(source, '') <> 'rewards' and owner_user_id is null)
      or owner_user_id = (select auth.uid())
    )
  )
);

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
  or (public.current_app_role() = 'shipper' and source = 'order' and status in ('ready', 'delivering', 'completed', 'cancelled'))
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
    or (public.current_app_role() = 'shipper' and o.source = 'order' and o.status in ('ready', 'delivering', 'completed', 'cancelled'))
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

drop policy if exists "pos_orders_staff_owner" on public.pos_orders;
create policy "pos_orders_staff_owner"
on public.pos_orders for all
to authenticated
using (public.is_staff_or_owner())
with check (public.is_staff_or_owner());

drop policy if exists "pos_order_items_staff_owner" on public.pos_order_items;
create policy "pos_order_items_staff_owner"
on public.pos_order_items for all
to authenticated
using (public.is_staff_or_owner())
with check (public.is_staff_or_owner());

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

-- ------------------------------------------------------------
-- Grants (required in addition to RLS policies)
-- ------------------------------------------------------------
-- Supabase roles used by PostgREST: anon/authenticated/service_role.
-- If these grants are missing, queries can fail with:
--   "permission denied for table <table_name>"

grant usage on schema public to anon, authenticated, service_role;

-- Readable without login
grant select on table public.menu_items to anon, authenticated;
grant select on table public.vouchers to anon, authenticated;

-- Authenticated access (RLS policies still restrict rows/ops)
grant select, insert, update, delete on table public.profiles to authenticated;
grant select on table public.profile_details to authenticated;
grant select, insert, update, delete on table public.customer_profiles to authenticated;
grant select, insert, update, delete on table public.staff_profiles to authenticated;
grant select, insert, update, delete on table public.owner_profiles to authenticated;
grant select, insert, update, delete on table public.shipper_profiles to authenticated;
grant select, insert, update, delete on table public.menu_items to authenticated;
grant select, insert, update, delete on table public.vouchers to authenticated;
grant select, insert, update, delete on table public.user_vouchers to authenticated;
grant select, insert, update, delete on table public.carts to authenticated;
grant select, insert, update, delete on table public.cart_items to authenticated;
grant select, insert, update, delete on table public.orders to authenticated;
grant select, insert, update, delete on table public.order_items to authenticated;
grant select, insert, update, delete on table public.pos_orders to authenticated;
grant select, insert, update, delete on table public.pos_order_items to authenticated;
grant select, insert, update, delete on table public.reservations to authenticated;
grant select, insert, update, delete on table public.app_sequences to authenticated;

grant execute on function public.redeem_points_for_voucher(integer) to authenticated;
grant execute on function public.owner_create_customer_user(jsonb) to authenticated;
grant execute on function public.owner_create_actor_user(jsonb) to authenticated;
grant execute on function public.owner_update_actor_user(uuid, jsonb) to authenticated;
grant execute on function public.owner_delete_actor_user(uuid) to authenticated;

-- Safe defaults for any sequences (if present)
grant usage, select on all sequences in schema public to authenticated;
