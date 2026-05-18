import { readJson, removeStorageKey, writeJson } from '../../core/storage.js';
import { isSupabaseConfigured } from '../../services/supabaseClient.js';
import { remoteDataService } from '../../services/remoteDataService.js';

const SHIPPER_USERS_KEY = 'dq_shipper_users';
const SHIPPER_CURRENT_KEY = 'dq_shipper_current';

const nowIso = () => new Date().toISOString();
const normalizePhone = (phone = '') => phone.toString().trim().replace(/\s+/g, '');
const isShipperId = (id) => /^D\d{5}$/.test((id || '').toString());
const formatShipperId = (n) => `D${String(n).padStart(5, '0').slice(-5)}`;

const isLegacyShipperSeed = (user = {}) =>
  user.id === 'D00000';

const sanitizeShippers = (users = []) => {
  const used = new Set();
  let next = 0;

  const nextId = () => {
    while (used.has(formatShipperId(next))) next += 1;
    const id = formatShipperId(next);
    used.add(id);
    next += 1;
    return id;
  };

  return (Array.isArray(users) ? users : []).filter((user) => !isLegacyShipperSeed(user)).map((user) => {
    const rawId = (user?.id || '').toString();
    const id = isShipperId(rawId) && !used.has(rawId) ? rawId : nextId();
    used.add(id);
    return {
      id,
      name: (user?.name || '').toString(),
      password: (user?.password || '').toString(),
      phone: normalizePhone(user?.phone),
      createdAt: user?.createdAt || nowIso(),
    };
  });
};

export const ensureShipperUsers = () => {
  const storedUsers = sanitizeShippers(readJson(SHIPPER_USERS_KEY, []));
  writeJson(SHIPPER_USERS_KEY, storedUsers);
  return storedUsers;
};

export const getShipperUsers = () => {
  ensureShipperUsers();
  return readJson(SHIPPER_USERS_KEY, []);
};

export const getCurrentShipper = () => {
  ensureShipperUsers();
  const current = readJson(SHIPPER_CURRENT_KEY, null);
  if (current && isLegacyShipperSeed(current)) {
    logoutShipper();
    return null;
  }
  return current && typeof current === 'object' ? current : null;
};

export const loginShipper = async (phone, password) => {
  if (isSupabaseConfigured()) {
    try {
      await remoteDataService.signInWithPhonePassword(phone, password);
      const profile = await remoteDataService.waitForCurrentProfile();
      if (!profile || profile.role !== 'shipper') {
        await remoteDataService.signOut().catch(() => {});
        return { ok: false, msg: 'Tài khoản này không phải tài khoản shipper.' };
      }
      const safe = {
        id: profile.id,
        authId: profile.authId,
        name: profile.name,
        phone: profile.phone,
        createdAt: profile.createdAt,
        loggedInAt: nowIso(),
      };
      writeJson(SHIPPER_CURRENT_KEY, safe);
      return { ok: true, shipper: safe };
    } catch (error) {
      return { ok: false, msg: error?.message || 'Không thể đăng nhập.' };
    }
  }
  const user = getShipperUsers().find(
    (item) => normalizePhone(item?.phone) === normalizePhone(phone) && (item?.password || '') === password
  );
  if (!user) return { ok: false, msg: 'Số điện thoại hoặc mật khẩu không đúng.' };
  const safe = {
    id: user.id,
    name: user.name,
    phone: user.phone,
    createdAt: user.createdAt,
    loggedInAt: nowIso(),
  };
  writeJson(SHIPPER_CURRENT_KEY, safe);
  return { ok: true, shipper: safe };
};

export const logoutShipper = () => {
  removeStorageKey(SHIPPER_CURRENT_KEY);
  if (isSupabaseConfigured()) remoteDataService.signOut().catch(() => {});
};
