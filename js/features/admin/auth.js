/**
 * staffAuth.js - Simple staff auth stored in LocalStorage
 * Separate from customer auth (store.js)
 */

import { readJson, removeStorageKey, writeJson } from '../../core/storage.js';
import { isSupabaseConfigured } from '../../services/supabaseClient.js';
import { remoteDataService } from '../../services/remoteDataService.js';

const STAFF_USERS_KEY = 'dq_staff_users';
const STAFF_CURRENT_KEY = 'dq_staff_current';

const nowIso = () => new Date().toISOString();
const normalizePhone = (phone = '') => phone.toString().trim().replace(/\s+/g, '');
const isStaffId = (id) => /^NV\d{5}$/.test((id || '').toString());
const formatStaffId = (n) => `NV${String(n).padStart(5, '0').slice(-5)}`;
const isLegacyStaffSeed = (user = {}) =>
  user.id === 's_seed_1'
  || user.id === 'E00000'
  || user.id === 'NV00000'
  || ((user.username || '').toString() === 'staff' && (user.password || '').toString() === '123');

const sanitizeStaffUsers = (users = []) => {
  const source = (Array.isArray(users) ? users : []).filter((user) => !isLegacyStaffSeed(user));
  const used = new Set();
  let next = 1;

  const nextId = () => {
    while (used.has(formatStaffId(next))) next += 1;
    const id = formatStaffId(next);
    used.add(id);
    next += 1;
    return id;
  };

  return source.map((user) => {
    const rawId = (user?.id || '').toString();
    const id = isStaffId(rawId) && !used.has(rawId) ? rawId : nextId();
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

export const ensureStaffUsers = () => {
  const storedUsers = sanitizeStaffUsers(readJson(STAFF_USERS_KEY, []));
  writeJson(STAFF_USERS_KEY, storedUsers);
  return storedUsers;
};

export const getStaffUsers = () => {
  ensureStaffUsers();
  return readJson(STAFF_USERS_KEY, []);
};

export const getCurrentStaff = () => {
  ensureStaffUsers();
  const cur = readJson(STAFF_CURRENT_KEY, null);
  if (cur && isLegacyStaffSeed(cur)) {
    logoutStaff();
    return null;
  }
  return cur && typeof cur === 'object' ? cur : null;
};

export const loginStaff = async (phone, password) => {
  if (isSupabaseConfigured()) {
    try {
      await remoteDataService.signInWithPhonePassword(phone, password);
      const profile = await remoteDataService.waitForCurrentProfile();
      if (!profile || profile.role !== 'staff') {
        await remoteDataService.signOut().catch(() => {});
        return { ok: false, msg: 'Tài khoản này không phải tài khoản nhân viên.' };
      }
      const safe = { id: profile.id, authId: profile.authId, name: profile.name, phone: profile.phone, loggedInAt: nowIso() };
      writeJson(STAFF_CURRENT_KEY, safe);
      return { ok: true, staff: safe };
    } catch (error) {
      return { ok: false, msg: error?.message || 'Không thể đăng nhập.' };
    }
  }
  const users = getStaffUsers();
  const u = users.find(
    (x) => normalizePhone(x?.phone) === normalizePhone(phone) && (x?.password || '') === password
  );
  if (!u) return { ok: false, msg: 'Số điện thoại hoặc mật khẩu không đúng.' };
  const safe = { id: u.id, name: u.name, phone: u.phone, loggedInAt: nowIso() };
  writeJson(STAFF_CURRENT_KEY, safe);
  return { ok: true, staff: safe };
};

export const logoutStaff = () => {
  removeStorageKey(STAFF_CURRENT_KEY);
  if (isSupabaseConfigured()) remoteDataService.signOut().catch(() => {});
};

export const requireStaff = (redirectTo = 'admin.html') => {
  const staff = getCurrentStaff();
  if (staff) return staff;
  const target = redirectTo || 'admin.html';
  if (window.location.pathname.split('/').pop() !== target) {
    window.location.href = target;
  }
  return null;
};
