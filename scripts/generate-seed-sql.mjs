import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = resolve(root, 'db.json');
const outPath = resolve(root, 'supabase/seed.generated.sql');

const db = JSON.parse(await readFile(dbPath, 'utf8'));

const sqlString = (value) => {
  if (value === null || value === undefined || value === '') return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
};

const sqlInt = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toString() : fallback.toString();
};

const sqlBool = (value) => value ? 'true' : 'false';

const normalizeImagePath = (value) => {
  const raw = (value || 'assets/images/placeholder.svg').toString().trim();
  return raw.startsWith('/') ? raw.slice(1) : raw;
};

const parseNullableTimestamp = (value) => {
  const raw = (value || '').toString().trim();
  if (!raw) return 'null';
  return sqlString(raw);
};

const statements = [];
statements.push('-- Generated from db.json. Review before running in Supabase SQL Editor.');
statements.push('begin;');

(db.menu || []).forEach((item, index) => {
  statements.push(`
insert into public.menu_items (id, name, category, price, description, image_path, status, sold, sort_order, created_at, updated_at)
values (${sqlString(item.id)}, ${sqlString(item.name)}, ${sqlString(item.category || 'com')}::public.menu_category, ${sqlInt(item.price)}, ${sqlString(item.desc || '')}, ${sqlString(normalizeImagePath(item.img))}, ${sqlString(item.status || 'available')}::public.menu_status, ${sqlInt(item.sold)}, ${index}, now(), now())
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  price = excluded.price,
  description = excluded.description,
  image_path = excluded.image_path,
  status = excluded.status,
  sold = excluded.sold,
  sort_order = excluded.sort_order,
  updated_at = now();`.trim());
});

(db.vouchers || []).forEach((voucher) => {
  statements.push(`
insert into public.vouchers (code, type, value, min_order, description, active, starts_at, expires_at, source, created_at, updated_at)
values (${sqlString((voucher.code || '').toString().toUpperCase())}, ${sqlString(voucher.type === 'percent' ? 'percent' : 'fixed')}, ${sqlInt(voucher.value)}, ${sqlInt(voucher.minOrder)}, ${sqlString(voucher.desc || '')}, ${sqlBool(voucher.active)}, ${parseNullableTimestamp(voucher.startsAt)}, ${parseNullableTimestamp(voucher.expiresAt)}, ${sqlString(voucher.source || null)}, now(), now())
on conflict (code) do update set
  type = excluded.type,
  value = excluded.value,
  min_order = excluded.min_order,
  description = excluded.description,
  active = excluded.active,
  starts_at = excluded.starts_at,
  expires_at = excluded.expires_at,
  source = excluded.source,
  updated_at = now();`.trim());
});

const seedMeta = db.meta || {};
const seqValues = [
  ['order', seedMeta.orderSeq || highestSeq(db.orders, /^ORD-(\d{4})$/)],
  ['pos_order', seedMeta.posOrderSeq || highestSeq(db.orders, /^POS-(\d{4})$/)],
  ['reservation', seedMeta.reservationSeq || highestSeq(db.reservations, /^RES-(\d{4})$/)],
  ['customer_code', highestNumericCode(db.users)],
];

seqValues.forEach(([key, value]) => {
  statements.push(`
insert into public.app_sequences (key, value)
values (${sqlString(key)}, ${sqlInt(value)})
on conflict (key) do update set value = greatest(public.app_sequences.value, excluded.value);`.trim());
});

statements.push('commit;');
statements.push('');
statements.push('-- Customer/staff/owner/shipper accounts are intentionally not inserted here.');
statements.push('-- Create real accounts with Supabase Auth, then add rows in public.profiles with the matching auth.users.id.');

await writeFile(outPath, statements.join('\n\n'));
console.log(`Wrote ${outPath}`);

function highestSeq(rows = [], pattern) {
  return (rows || []).reduce((max, row) => {
    const match = pattern.exec((row?.id || '').toString());
    const n = match ? Number(match[1]) : 0;
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
}

function highestNumericCode(users = []) {
  return (users || []).reduce((max, user) => {
    const raw = (user?.id || '').toString();
    const n = /^\d{6}$/.test(raw) ? Number(raw) : 0;
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
}
