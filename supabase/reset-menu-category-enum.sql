-- Recreate menu_category enum with the current category set only.
-- Run after reset-test-data.sql, while menu/order tables are empty.

begin;

alter table public.menu_items
  alter column category type text using category::text;

alter table public.order_items
  alter column category type text using category::text;

drop type if exists public.menu_category;

create type public.menu_category as enum ('ga', 'vit', 'bun', 'mien', 'chao', 'kho');

alter table public.menu_items
  alter column category type public.menu_category using (
    case category
      when 'ga' then 'ga'
      when 'vit' then 'vit'
      when 'bun' then 'bun'
      when 'mien' then 'mien'
      when 'chao' then 'chao'
      else 'kho'
    end
  )::public.menu_category;

alter table public.order_items
  alter column category type public.menu_category using (
    case category
      when 'ga' then 'ga'
      when 'vit' then 'vit'
      when 'bun' then 'bun'
      when 'mien' then 'mien'
      when 'chao' then 'chao'
      else null
    end
  )::public.menu_category;

commit;
