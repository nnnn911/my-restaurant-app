import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = resolve(root, 'supabase/seed.generated.sql');

const sql = `-- Empty seed for Quán Ăn Đồng Quê.
-- db.json has been removed. Menu, vouchers, users, orders, reservations,
-- carts, and sold counts should be managed in Supabase.

begin;

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

commit;
`;

await writeFile(outPath, sql);
console.log(`Wrote ${outPath}`);
