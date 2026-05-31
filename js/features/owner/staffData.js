import { readJson, writeJson } from '../../core/storage.js';
import { isSupabaseConfigured } from '../../services/supabaseClient.js';
import { remoteDataService } from '../../services/remoteDataService.js';

const STAFF_USERS_KEY = 'dq_staff_users';
const SHIPPER_USERS_KEY = 'dq_shipper_users';

const nowIso = () => new Date().toISOString();
const normalizePhone = (phone = '') => phone.toString().trim().replace(/\s+/g, '');
const formatActorId = (role, n) => `${role === 'shipper' ? 'SP' : 'NV'}${String(n).padStart(5, '0').slice(-5)}`;

const sanitizeActor = (actor = {}, fallbackRole = 'staff') => ({
  id: actor.id || '',
  authId: actor.authId || null,
  name: (actor.name || '').toString(),
  phone: normalizePhone(actor.phone),
  salaryVnd: Math.max(0, Number(actor.salaryVnd || 0)),
  password: (actor.password || '').toString(),
  role: actor.role === 'shipper' ? 'shipper' : fallbackRole,
  createdAt: actor.createdAt || nowIso(),
});

const getLocalRoleActors = (key, role) => readJson(key, []).map((actor) => sanitizeActor(actor, role));

const writeLocalRoleActors = (key, actors) => {
  writeJson(key, actors.map((actor) => ({
    id: actor.id,
    name: actor.name,
    phone: actor.phone,
    salaryVnd: Number(actor.salaryVnd || 0),
    password: actor.password || '',
    createdAt: actor.createdAt || nowIso(),
  })));
};

const nextLocalId = (role, actors) => {
  const used = new Set(actors.filter((actor) => actor.role === role).map((actor) => actor.id));
  let next = 1;
  while (used.has(formatActorId(role, next))) next += 1;
  return formatActorId(role, next);
};

const readLocalActors = () => [
  ...getLocalRoleActors(STAFF_USERS_KEY, 'staff'),
  ...getLocalRoleActors(SHIPPER_USERS_KEY, 'shipper'),
].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

const writeLocalActors = (actors) => {
  const safe = actors.map((actor) => sanitizeActor(actor, actor.role));
  writeLocalRoleActors(STAFF_USERS_KEY, safe.filter((actor) => actor.role === 'staff'));
  writeLocalRoleActors(SHIPPER_USERS_KEY, safe.filter((actor) => actor.role === 'shipper'));
};

const validateActor = (actor = {}, existing = []) => {
  const name = (actor.name || '').toString().trim();
  const phone = normalizePhone(actor.phone);
  const role = actor.role === 'shipper' ? 'shipper' : 'staff';
  if (!name) throw new Error('Vui lòng nhập tên nhân viên.');
  if (!phone) throw new Error('Vui lòng nhập số điện thoại.');
  if (existing.some((item) => item.id !== actor.id && normalizePhone(item.phone) === phone)) {
    throw new Error('Số điện thoại đã được sử dụng.');
  }
  return { ...actor, name, phone, role };
};

export const getStaffActors = async () => {
  if (isSupabaseConfigured()) return remoteDataService.getStaffActors();
  return readLocalActors();
};

export const saveStaffActor = async (actor = {}) => {
  const existing = isSupabaseConfigured() ? [] : readLocalActors();
  const safe = validateActor(actor, existing);
  const isEdit = Boolean(actor.id);

  if (isSupabaseConfigured()) {
    if (isEdit) return remoteDataService.updateStaffActor(safe);
    return remoteDataService.createStaffActor(safe);
  }

  const actors = existing;
  if (!safe.authId && !safe.password) throw new Error('Vui lòng nhập mật khẩu khi tạo nhân viên.');
  const idx = actors.findIndex((item) => item.id === safe.id);
  const nextActor = sanitizeActor({
    ...safe,
    id: safe.id || nextLocalId(safe.role, actors),
    password: safe.password || (idx >= 0 ? actors[idx].password : ''),
    createdAt: safe.createdAt || nowIso(),
  }, safe.role);

  if (idx >= 0) actors[idx] = nextActor;
  else actors.push(nextActor);
  writeLocalActors(actors);
  return nextActor;
};

export const deleteStaffActor = async (actor = {}) => {
  if (isSupabaseConfigured()) return remoteDataService.deleteStaffActor(actor);
  const actors = readLocalActors();
  writeLocalActors(actors.filter((item) => item.id !== actor.id));
  return actor;
};
