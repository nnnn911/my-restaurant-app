-- Reset all Supabase test data for Quán Ăn Đồng Quê.
-- Use only in a development/test Supabase project.
--
-- What this does:
-- 1. Deletes application data in public tables.
-- 2. Resets app_sequences to a clean starting state.
-- 3. Deletes Supabase Auth users so signup/login can be tested again.
--
-- After running this file, run:
-- 1. supabase/schema.sql
-- 2. supabase/seed.generated.sql
-- 3. Recreate owner/staff/shipper users if needed.

begin;

truncate table
  public.order_items,
  public.orders,
  public.reservations,
  public.cart_items,
  public.carts,
  public.user_vouchers,
  public.vouchers,
  public.menu_items,
  public.profiles,
  public.app_sequences
restart identity cascade;

insert into public.app_sequences (key, value)
values
  ('order', 0),
  ('pos_order', 0),
  ('reservation', 0),
  ('customer_code', 0),
  ('staff_code', 0),
  ('owner_code', 0),
  ('shipper_code', 0)
on conflict (key) do update set value = excluded.value;

-- This removes all Auth users in the current Supabase project.
-- If this fails in SQL Editor because of permission restrictions,
-- delete users manually in Dashboard > Authentication > Users.
delete from auth.users;

commit;
