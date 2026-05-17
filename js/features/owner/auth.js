/**
 * ownerAuth.js - Store owner auth stored in LocalStorage
 * Schema mirrors staff accounts, but ids use A00000 format.
 */

import { getStaticArray } from '../../data/db.js';
import { readJson, removeStorageKey, writeJson, writeJsonIfChanged } from '../../core/storage.js';
import { isSupabaseConfigured } from '../../services/supabaseClient.js';
import { remoteDataService } from '../../services/remoteDataService.js';

const OWNER_USERS_KEY = 'dq_owner_users';
const OWNER_CURRENT_KEY = 'dq_owner_current';
let staticOwnerUsersCache = null;
let ownerUsersReady = false;

const nowIso = () => new Date().toISOString();
const normalizePhone = (phone = '') => phone.toString().trim().replace(/\s+/g, '');
const isOwnerId = (id) => /^A\d{5}$/.test((id || '').toString());
const formatOwnerId = (n) => `A${String(n).padStart(5, '0').slice(-5)}`;

const loadStaticOwnerUsers = () => {
  if (staticOwnerUsersCache) return staticOwnerUsersCache;
  staticOwnerUsersCache = getStaticArray('ownerUsers');
  return staticOwnerUsersCache;
};

const sanitizeOwnerUsers = (users = []) => {
  const source = Array.isArray(users) ? users : [];
  const used = new Set();
  let next = 0;

  const nextId = () => {
    while (used.has(formatOwnerId(next))) next += 1;
    const id = formatOwnerId(next);
    used.add(id);
    next += 1;
    return id;
  };

  return source.map((user) => {
    const rawId = (user?.id || '').toString();
    const id = isOwnerId(rawId) && !used.has(rawId) ? rawId : nextId();
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

export const ensureOwnerUsers = () => {
  if (ownerUsersReady) return readJson(OWNER_USERS_KEY, []);
  const storedUsers = sanitizeOwnerUsers(readJson(OWNER_USERS_KEY, []));
  const staticUsers = sanitizeOwnerUsers(loadStaticOwnerUsers());
  const users = [...storedUsers];

  staticUsers.forEach((staticUser) => {
    const sameIdIdx = users.findIndex((u) => u.id === staticUser.id);
    if (sameIdIdx >= 0) {
      users[sameIdIdx] = {
        ...staticUser,
        ...users[sameIdIdx],
        phone: users[sameIdIdx].phone || staticUser.phone,
        password: users[sameIdIdx].phone ? users[sameIdIdx].password : staticUser.password,
      };
      return;
    }
    const exists = users.some((u) => u.phone && u.phone === staticUser.phone);
    if (!exists) users.push(staticUser);
  });

  writeJsonIfChanged(OWNER_USERS_KEY, users);
  ownerUsersReady = true;
  return users;
};

export const getOwnerUsers = () => {
  ensureOwnerUsers();
  return readJson(OWNER_USERS_KEY, []);
};

export const getCurrentOwner = () => {
  const cur = readJson(OWNER_CURRENT_KEY, null);
  return cur && typeof cur === 'object' ? cur : null;
};

export const loginOwner = async (phone, password) => {
  if (isSupabaseConfigured()) {
    try {
      await remoteDataService.signInWithPhonePassword(phone, password);
      const profile = await remoteDataService.waitForCurrentProfile();
      if (!profile || profile.role !== 'owner') {
        await remoteDataService.signOut().catch(() => {});
        return { ok: false, msg: 'Tài khoản này không phải tài khoản chủ cửa hàng.' };
      }
      const safe = { id: profile.id, authId: profile.authId, name: profile.name, phone: profile.phone, loggedInAt: nowIso() };
      writeJson(OWNER_CURRENT_KEY, safe);
      return { ok: true, owner: safe };
    } catch (error) {
      return { ok: false, msg: error?.message || 'Không thể đăng nhập.' };
    }
  }
  const users = getOwnerUsers();
  const u = users.find(
    (x) => normalizePhone(x?.phone) === normalizePhone(phone) && (x?.password || '') === password
  );
  if (!u) return { ok: false, msg: 'Số điện thoại hoặc mật khẩu không đúng.' };
  const safe = { id: u.id, name: u.name, phone: u.phone, loggedInAt: nowIso() };
  writeJson(OWNER_CURRENT_KEY, safe);
  return { ok: true, owner: safe };
};

export const logoutOwner = () => {
  removeStorageKey(OWNER_CURRENT_KEY);
  if (isSupabaseConfigured()) remoteDataService.signOut().catch(() => {});
};

export const requireOwner = (redirectTo = 'owner.html') => {
  const owner = getCurrentOwner();
  if (owner) return owner;
  const target = redirectTo || 'owner.html';
  if (window.location.pathname.split('/').pop() !== target) {
    window.location.href = target;
  }
  return null;
};
