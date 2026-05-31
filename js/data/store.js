/**
 * store.js - LocalStorage cache + Supabase data management module
 * Quán Ăn Đồng Quê
 */

import { readJson, removeStorageKey, writeJson, writeJsonIfChanged } from '../core/storage.js';
import { isSupabaseConfigured } from '../services/supabaseClient.js';
import { remoteDataService } from '../services/remoteDataService.js';

// Single-key storage (preparing for Admin/Shipper apps)
const DB_KEY = 'dq_db';
const DB_SCHEMA_VERSION = 6;
const DB_PURGE_KEY = 'dq_db_json_purge_version';
const DB_PURGE_VERSION = 1;

// Legacy keys (for one-time migration)
const LEGACY_KEYS = {
  USERS: 'dq_users',
  CURRENT: 'dq_current_user',
  ORDERS: 'dq_orders',
  CART: 'dq_cart',
  VOUCHERS: 'dq_vouchers',
  MENU: 'dq_menu',
  RESERVATIONS: 'dq_reservations',
};

let dbCache = null;

const nowIso = () => new Date().toISOString();

const mergeByKey = (base = [], overrides = [], key = 'id') => {
  const overrideArr = Array.isArray(overrides) ? overrides : [];
  const overrideMap = new Map(overrideArr.filter((i) => i?.[key]).map((i) => [i[key], i]));
  const merged = (Array.isArray(base) ? base : []).map((item) => ({
    ...item,
    ...(overrideMap.get(item[key]) || {}),
  }));
  const extras = overrideArr.filter((item) => item?.[key] && !(base || []).some((baseItem) => baseItem[key] === item[key]));
  return [...merged, ...extras];
};

const mergeById = (base = [], overrides = []) => mergeByKey(base, overrides, 'id');

const PAYMENT_METHODS = new Set(['cash', 'bank', 'momo', 'vnpay']);

const normalizePaymentMethod = (value) => {
  const method = (value || 'cash').toString().trim().toLowerCase();
  if (method === 'transfer') return 'bank';
  return PAYMENT_METHODS.has(method) ? method : 'cash';
};

const normalizeDateTimeLocal = (value, fallbackTime = '00:00') => {
  const raw = (value || '').toString().trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T${fallbackTime}`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const normalizeVoucher = (voucher = {}) => ({
  ...voucher,
  code: (voucher.code || '').toString().trim().toUpperCase(),
  type: voucher.type === 'percent' ? 'percent' : 'fixed',
  value: Number.isFinite(Number(voucher.value)) ? Number(voucher.value) : 0,
  minOrder: Number.isFinite(Number(voucher.minOrder)) ? Number(voucher.minOrder) : 0,
  startsAt: normalizeDateTimeLocal(voucher.startsAt, '00:00'),
  expiresAt: normalizeDateTimeLocal(voucher.expiresAt, '23:59'),
  desc: (voucher.desc || '').toString(),
  active: Boolean(voucher.active),
});

const normalizeOrderRecord = (order = {}) => ({
  ...order,
  paymentMethod: normalizePaymentMethod(order.paymentMethod),
});

const normalizePhone = (phone = '') => phone.toString().trim().replace(/\s+/g, '');
const ROLE_ID_PREFIX = {
  customer: 'KH',
  staff: 'NV',
  owner: 'CH',
  shipper: 'SP',
};
const getRoleIdPrefix = (role = 'customer') => ROLE_ID_PREFIX[role] || ROLE_ID_PREFIX.customer;
const isRoleId = (id, role = 'customer') => new RegExp(`^${getRoleIdPrefix(role)}\\d{5}$`).test((id || '').toString());
const formatRoleId = (role, n) => `${getRoleIdPrefix(role)}${String(n).padStart(5, '0').slice(-5)}`;
const isLegacyCustomerSeed = (user = {}) =>
  (user.id || '').toString().startsWith('u_');

const sanitizeUser = (user = {}, id = user?.id) => {
  const points = Number(user.points || 0);
  const vouchers = Array.isArray(user.vouchers)
    ? user.vouchers
        .map((code) => (code || '').toString().trim().toUpperCase())
        .filter(Boolean)
    : [];
  return {
    id,
    authId: user.authId || user.auth_id || null,
    role: user.role || 'customer',
    name: (user.name || '').toString(),
    password: (user.password || '').toString(),
    phone: normalizePhone(user.phone),
    points: Number.isFinite(points) ? points : 0,
    vouchers,
    createdAt: user.createdAt || nowIso(),
  };
};

const shouldUseRemote = () => isSupabaseConfigured();

const runRemoteSync = (task) => {
  if (!shouldUseRemote() || typeof task !== 'function') return;
  task().catch((error) => {
    console.warn('[remote-sync] Không thể đồng bộ dữ liệu online:', error);
  });
};

const sanitizeUsersWithIds = (users = [], startAt = 1) => {
  const source = (Array.isArray(users) ? users : []).filter((user) => !isLegacyCustomerSeed(user));
  const used = new Set();
  const idMap = new Map();
  const nextByRole = {};

  const nextId = (role = 'customer') => {
    const safeRole = ROLE_ID_PREFIX[role] ? role : 'customer';
    let next = Number(nextByRole[safeRole] || startAt);
    while (used.has(formatRoleId(safeRole, next))) next += 1;
    const id = formatRoleId(safeRole, next);
    used.add(id);
    nextByRole[safeRole] = next + 1;
    return id;
  };

  const normalized = source.map((user) => {
    const rawId = (user?.id || '').toString();
    const role = user?.role || 'customer';
    const id = isRoleId(rawId, role) && !used.has(rawId) ? rawId : nextId(role);
    used.add(id);
    idMap.set(rawId, id);
    return sanitizeUser(user, id);
  });

  return { users: normalized, idMap };
};

const sanitizeUsers = (users = []) => sanitizeUsersWithIds(users).users;

const getNextUserId = (users = []) => {
  const ids = (Array.isArray(users) ? users : [])
    .filter((u) => (u?.role || 'customer') === 'customer')
    .map((u) => {
      const m = /^KH(\d{5})$/.exec((u?.id || '').toString());
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => Number.isFinite(n) && n >= 0);
  const max = ids.length ? Math.max(...ids) : 0;
  return formatRoleId('customer', max + 1);
};

const normalizeDbUsers = (db) => {
  const { users, idMap } = sanitizeUsersWithIds(db.users);
  const rawCurrentUserId = (db.currentUserId || '').toString();
  const mappedCurrentUserId = idMap.get(rawCurrentUserId) || rawCurrentUserId;
  const currentUserId = users.some((u) => u.id === mappedCurrentUserId) ? mappedCurrentUserId : null;
  const carts = {};

  Object.entries(db.carts || {}).forEach(([owner, cart]) => {
    const nextOwner = idMap.get(owner) || owner;
    carts[nextOwner] = [...(carts[nextOwner] || []), ...(Array.isArray(cart) ? cart : [])];
  });

  return { ...db, users, currentUserId, carts };
};

const createEmptyDb = () => ({
  schemaVersion: DB_SCHEMA_VERSION,
  createdAt: nowIso(),
  updatedAt: nowIso(),
  users: [],
  currentUserId: null,
  carts: {},
  orders: [],
  vouchers: null,
  menu: null,
  reservations: [],
  meta: {},
});

const normalizeCacheDb = (db = {}) => normalizeDbUsers({
  ...createEmptyDb(),
  ...db,
  schemaVersion: DB_SCHEMA_VERSION,
  users: sanitizeUsers(db.users || []),
  orders: (db.orders || []).map(normalizeOrderRecord),
  reservations: Array.isArray(db.reservations) ? db.reservations : [],
  vouchers: Array.isArray(db.vouchers) ? db.vouchers.map(normalizeVoucher) : [],
  menu: Array.isArray(db.menu) ? db.menu.map((item) => ({ ...item, sold: Number(item.sold || 0) })) : [],
  meta: db.meta && typeof db.meta === 'object' ? { ...db.meta } : {},
});

/* ---- Checkout draft (transient state stored in dq_db) ---- */
export const getCheckoutDraft = () => {
  const db = ensureDb();
  const draft = db?.meta?.checkoutDraft;
  return draft && typeof draft === 'object' ? draft : null;
};

export const setCheckoutDraft = (draft) => {
  const db = ensureDb();
  const next = draft && typeof draft === 'object' ? { ...draft, updatedAt: nowIso() } : null;
  const meta = { ...(db.meta || {}) };
  if (!next) delete meta.checkoutDraft;
  else meta.checkoutDraft = next;
  saveDb({ ...db, meta });
  return next;
};

export const clearCheckoutDraft = () => setCheckoutDraft(null);

const saveDb = (db) => {
  const safeDb = {
    ...createEmptyDb(),
    ...db,
    schemaVersion: DB_SCHEMA_VERSION,
    updatedAt: nowIso(),
  };
  dbCache = safeDb;
  writeJson(DB_KEY, safeDb);
  return safeDb;
};

const cleanupLegacyKeys = () => {
  Object.values(LEGACY_KEYS).forEach((key) => removeStorageKey(key));
};

const ensureDbJsonPurge = () => {
  try {
    if (localStorage.getItem(DB_PURGE_KEY) === String(DB_PURGE_VERSION)) return;
    removeStorageKey(DB_KEY);
    cleanupLegacyKeys();
    localStorage.setItem(DB_PURGE_KEY, String(DB_PURGE_VERSION));
    dbCache = null;
  } catch {
    // Ignore storage failures; app can still run with in-memory defaults.
  }
};

const migrateLegacyToDb = () => {
  const legacyUsers = readJson(LEGACY_KEYS.USERS, []);
  const legacyCurrent = readJson(LEGACY_KEYS.CURRENT, null);
  const legacyOrders = readJson(LEGACY_KEYS.ORDERS, []);
  const legacyCart = readJson(LEGACY_KEYS.CART, []);
  const legacyVouchers = readJson(LEGACY_KEYS.VOUCHERS, null);
  const legacyMenu = readJson(LEGACY_KEYS.MENU, null);
  const legacyReservations = readJson(LEGACY_KEYS.RESERVATIONS, []);

  const db = createEmptyDb();

  db.users = mergeById(db.users, Array.isArray(legacyUsers) ? legacyUsers : []);

  if (legacyCurrent && legacyCurrent.id) {
    db.currentUserId = legacyCurrent.id;
    const exists = db.users.some((u) => u.id === legacyCurrent.id);
    if (!exists) db.users.push(legacyCurrent);
  }

  const cartOwner = db.currentUserId || 'guest';
  db.carts = { [cartOwner]: Array.isArray(legacyCart) ? legacyCart : [] };

  db.orders = mergeById(db.orders, Array.isArray(legacyOrders) ? legacyOrders : []);
  db.vouchers = Array.isArray(legacyVouchers) ? mergeByKey(db.vouchers || [], legacyVouchers, 'code') : db.vouchers;
  db.menu = Array.isArray(legacyMenu) ? mergeById(db.menu || [], legacyMenu) : db.menu;
  db.reservations = mergeById(db.reservations, Array.isArray(legacyReservations) ? legacyReservations : []);

  db.meta = { ...(db.meta || {}), migratedFromLegacyAt: nowIso() };

  saveDb(normalizeCacheDb(db));
  cleanupLegacyKeys();
  return dbCache;
};

const ensureDb = () => {
  if (dbCache) return dbCache;
  ensureDbJsonPurge();
  const existing = readJson(DB_KEY, null);
  if (existing && typeof existing === 'object') {
    if (existing.schemaVersion !== DB_SCHEMA_VERSION) {
      const fresh = createEmptyDb();
      dbCache = fresh;
      writeJsonIfChanged(DB_KEY, fresh);
      cleanupLegacyKeys();
      return dbCache;
    }
    const normalized = normalizeCacheDb(existing);
    dbCache = normalized;
    writeJsonIfChanged(DB_KEY, normalized);
    return dbCache;
  }
  return migrateLegacyToDb();
};

export const hydrateOnlineData = async () => {
  if (!shouldUseRemote()) return { ok: true, remote: false };
  const db = ensureDb();
  const nextDb = { ...db, meta: { ...(db.meta || {}), lastOnlineHydrateAttemptAt: nowIso() } };

  try {
    const profile = await remoteDataService.getCurrentProfile().catch(() => null);
    if (profile?.id && profile.role === 'customer') {
      const users = Array.isArray(nextDb.users) ? [...nextDb.users] : [];
      const idx = users.findIndex((u) => u.id === profile.id);
      if (idx >= 0) users[idx] = sanitizeUser({ ...users[idx], ...profile }, profile.id);
      else users.push(sanitizeUser(profile, profile.id));
      nextDb.users = users;
      nextDb.currentUserId = profile.id;
    }

    const [menu, vouchers, orders, reservations, cart, users, userVoucherCodes] = await Promise.all([
      remoteDataService.getMenu().catch(() => null),
      remoteDataService.getVouchers().catch(() => null),
      remoteDataService.getOrders().catch(() => null),
      remoteDataService.getReservations().catch(() => null),
      profile?.role === 'customer' ? remoteDataService.getCart().catch(() => null) : Promise.resolve(null),
      ['owner', 'staff'].includes(profile?.role) ? remoteDataService.getUsers().catch(() => null) : Promise.resolve(null),
      profile?.role === 'customer' ? remoteDataService.getCurrentUserVoucherCodes().catch(() => null) : Promise.resolve(null),
    ]);

    if (Array.isArray(menu)) nextDb.menu = menu;
    if (Array.isArray(vouchers)) nextDb.vouchers = vouchers;
    if (Array.isArray(orders)) nextDb.orders = orders.map(normalizeOrderRecord);
    if (Array.isArray(reservations)) nextDb.reservations = reservations;
    if (Array.isArray(users)) nextDb.users = users.map((user) => sanitizeUser(user, user.id));
    if (profile?.role === 'customer' && Array.isArray(cart)) {
      nextDb.carts = { ...(nextDb.carts || {}), [profile.id]: cart };
    }
    if (profile?.role === 'customer' && Array.isArray(userVoucherCodes)) {
      const allUsers = Array.isArray(nextDb.users) ? [...nextDb.users] : [];
      const idx = allUsers.findIndex((user) => user.id === profile.id);
      const nextUser = sanitizeUser({
        ...(idx >= 0 ? allUsers[idx] : profile),
        vouchers: userVoucherCodes,
      }, profile.id);
      if (idx >= 0) allUsers[idx] = nextUser;
      else allUsers.push(nextUser);
      nextDb.users = allUsers;
      nextDb.currentUserId = profile.id;
    }

    nextDb.meta = {
      ...(nextDb.meta || {}),
      onlineEnabled: true,
      lastOnlineHydratedAt: nowIso(),
    };
    saveDb(nextDb);
    return { ok: true, remote: true };
  } catch (error) {
    nextDb.meta = {
      ...(nextDb.meta || {}),
      onlineEnabled: true,
      lastOnlineHydrateError: error?.message || 'Không thể tải dữ liệu online.',
      lastOnlineHydrateErrorAt: nowIso(),
    };
    saveDb(nextDb);
    return { ok: false, remote: true, error };
  }
};

let onlineRealtimeUnsubscribe = null;
let onlineRealtimeHydrateTimer = null;

export const startOnlineRealtime = (onChange) => {
  if (!shouldUseRemote() || onlineRealtimeUnsubscribe) return onlineRealtimeUnsubscribe;
  onlineRealtimeUnsubscribe = remoteDataService.subscribeBusinessChanges(() => {
    window.clearTimeout(onlineRealtimeHydrateTimer);
    onlineRealtimeHydrateTimer = window.setTimeout(async () => {
      const result = await hydrateOnlineData();
      if (result.ok && typeof onChange === 'function') onChange();
    }, 350);
  });
  return onlineRealtimeUnsubscribe;
};

export const stopOnlineRealtime = () => {
  if (typeof onlineRealtimeUnsubscribe === 'function') onlineRealtimeUnsubscribe();
  onlineRealtimeUnsubscribe = null;
  window.clearTimeout(onlineRealtimeHydrateTimer);
};

const getCartOwnerKey = () => {
  const db = ensureDb();
  return db.currentUserId || 'guest';
};

/* ---- Backwards-compatible helpers (previous API) ---- */
const getUsersFromDb = () => ensureDb().users || [];
const setUsersToDb = (users) => {
  const normalized = sanitizeUsers(users);
  saveDb({ ...ensureDb(), users: normalized });
  runRemoteSync(() => remoteDataService.saveUsers(normalized));
};

/* ---- Users ---- */
export const getUsers = () => getUsersFromDb();
export const saveUsers = (users) => setUsersToDb(users);

export const createUserOnline = async (user = {}) => {
  const db = ensureDb();
  const users = sanitizeUsers(db.users || []);
  const phone = normalizePhone(user.phone);
  if (!phone) throw new Error('Vui lòng nhập số điện thoại.');
  if (users.some((item) => normalizePhone(item.phone) === phone)) {
    throw new Error('Số điện thoại đã được sử dụng.');
  }

  let nextUser = sanitizeUser({
    ...user,
    id: getNextUserId(users),
    phone,
    role: 'customer',
    points: Math.max(0, Number(user.points || 0)),
    createdAt: nowIso(),
  });

  if (shouldUseRemote()) {
    nextUser = sanitizeUser(await remoteDataService.createCustomer(nextUser), nextUser.id);
  }

  const nextUsers = sanitizeUsers([...users, nextUser]);
  saveDb({ ...db, users: nextUsers });
  return nextUsers.find((item) => item.id === nextUser.id) || nextUser;
};

export const deleteUserOnline = async (userId) => {
  const users = getUsers();
  if (shouldUseRemote()) await remoteDataService.deleteCustomer(userId);
  saveDb({ ...ensureDb(), users: sanitizeUsers(users.filter((user) => user.id !== userId)) });
};

export const updateUserPointsOnline = async (userId, points) => {
  const db = ensureDb();
  const users = sanitizeUsers(db.users || []);
  const idx = users.findIndex((user) => user.id === userId);
  if (idx === -1) throw new Error('Không tìm thấy tài khoản khách hàng.');

  let updated = sanitizeUser({ ...users[idx], points: Math.max(0, Number(points || 0)) }, users[idx].id);
  if (shouldUseRemote()) {
    updated = await remoteDataService.updateUserPoints(userId, updated.points);
  }

  users[idx] = sanitizeUser({ ...users[idx], ...updated }, userId);
  const nextDb = saveDb({ ...db, users });
  if (nextDb.currentUserId === userId) saveCurrentUser(users[idx]);
  return users[idx];
};

export const getCurrentUser = () => {
  const db = ensureDb();
  if (!db.currentUserId) return null;
  return (db.users || []).find((u) => u.id === db.currentUserId) || null;
};

export const saveCurrentUser = (user) => {
  if (!user || !user.id) return;
  const safeUser = sanitizeUser(user);
  const db = ensureDb();
  const users = Array.isArray(db.users) ? [...db.users] : [];
  const idx = users.findIndex((u) => u.id === safeUser.id);
  if (idx >= 0) users[idx] = sanitizeUser({ ...users[idx], ...safeUser });
  else users.push(safeUser);
  saveDb({ ...db, users, currentUserId: safeUser.id });
};

export const clearCurrentUser = () => {
  const db = ensureDb();
  saveDb({ ...db, currentUserId: null });
  runRemoteSync(() => remoteDataService.signOut());
};

export const registerUser = (data) => {
  const users = getUsers();
  const phone = normalizePhone(data.phone);
  if (users.find(u => normalizePhone(u.phone) === phone)) return { ok: false, msg: 'Số điện thoại đã được sử dụng.' };
  const user = {
    id: getNextUserId(users),
    name: data.name,
    password: data.password,
    phone,
    points: 0,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return { ok: true, user };
};

export const loginUser = (phone, password) => {
  const users = getUsers();
  const user = users.find(u => normalizePhone(u.phone) === normalizePhone(phone) && u.password === password);
  if (!user) return { ok: false, msg: 'Số điện thoại hoặc mật khẩu không đúng.' };
  saveCurrentUser(user);
  return { ok: true, user };
};

export const updateUser = async (updates) => {
  const current = getCurrentUser();
  if (!current) return;
  const users = getUsers();
  const idx = users.findIndex(u => u.id === current.id);
  if (idx === -1) return;
  const nextPhone = updates?.phone ? normalizePhone(updates.phone) : '';
  if (nextPhone && users.some((u) => u.id !== current.id && normalizePhone(u.phone) === nextPhone)) {
    return { ok: false, msg: 'Số điện thoại đã được sử dụng.' };
  }
  let updated = sanitizeUser({ ...users[idx], ...updates });
  if (shouldUseRemote()) {
    const remoteProfile = await remoteDataService.updateCurrentProfile(updated);
    updated = sanitizeUser({ ...updated, ...remoteProfile }, updated.id);
  }
  users[idx] = updated;
  if (shouldUseRemote()) saveDb({ ...ensureDb(), users: sanitizeUsers(users) });
  else saveUsers(users);
  saveCurrentUser(updated);
  return { ok: true, user: updated };
};

export const addPoints = (userId, points) => {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return null;
  users[idx].points = (users[idx].points || 0) + points;
  saveUsers(users);
  const current = getCurrentUser();
  if (current && current.id === userId) saveCurrentUser(users[idx]);
  return users[idx];
};

export const calculateOrderPoints = (orderOrTotal) => {
  const total = typeof orderOrTotal === 'number' ? orderOrTotal : Number(orderOrTotal?.total || 0);
  return Number.isFinite(total) && total > 0 ? Math.floor(total / 10000) : 0;
};

/* ---- Cart ---- */
export const getCart = () => {
  const db = ensureDb();
  const key = getCartOwnerKey();
  const cart = db.carts?.[key];
  return Array.isArray(cart) ? cart : [];
};

export const saveCart = (cart) => {
  const db = ensureDb();
  const key = getCartOwnerKey();
  const carts = { ...(db.carts || {}) };
  carts[key] = Array.isArray(cart) ? cart : [];
  saveDb({ ...db, carts });
  runRemoteSync(() => remoteDataService.saveCart(carts[key]));
};

export const clearCart = () => {
  saveCart([]);
};

export const addToCart = (item) => {
  const cart = getCart();
  const note = (item.note || '').toString().trim();
  const existing = cart.find(c => c.id === item.id && (c.note || '').toString().trim() === note);
  if (existing) {
    existing.qty += item.qty || 1;
  } else {
    cart.push({ ...item, note, qty: item.qty || 1, cartId: 'ci_' + Date.now() + Math.random() });
  }
  saveCart(cart);
  return cart;
};

export const removeFromCart = (cartId) => {
  const cart = getCart().filter(c => c.cartId !== cartId);
  saveCart(cart);
  return cart;
};

export const updateCartQty = (cartId, qty) => {
  const cart = getCart();
  const item = cart.find(c => c.cartId === cartId);
  if (item) { if (qty <= 0) return removeFromCart(cartId); item.qty = qty; }
  saveCart(cart);
  return cart;
};

export const updateCartItemNote = (cartId, note = '') => {
  const cart = getCart();
  const item = cart.find(c => c.cartId === cartId);
  if (!item) return cart;
  item.note = note.toString().trim();
  saveCart(cart);
  return cart;
};

export const getCartTotal = () =>
  getCart().reduce((sum, c) => sum + c.price * c.qty, 0);

export const getCartCount = () =>
  getCart().reduce((sum, c) => sum + c.qty, 0);

/* ---- Orders ---- */
export const getOrders = () => {
  const db = ensureDb();
  return Array.isArray(db.orders) ? db.orders : [];
};

export const saveOrders = (orders) => {
  const db = ensureDb();
  const normalized = Array.isArray(orders) ? orders.map(normalizeOrderRecord) : [];
  saveDb({ ...db, orders: normalized });
  runRemoteSync(() => remoteDataService.saveOrders(normalized));
};

export const createOrder = (orderData) => {
  const db = ensureDb();
  const orders = Array.isArray(db.orders) ? [...db.orders] : [];

  const meta = { ...(db.meta || {}) };
  const isPosOrder = (orderData?.source || '').toString() === 'pos';
  const idPrefix = isPosOrder ? 'POS' : 'ORD';
  const metaSeqKey = isPosOrder ? 'posOrderSeq' : 'orderSeq';

  const parseSeqFromId = (id) => {
    const m = new RegExp(`^${idPrefix}-(\\d{4})$`).exec((id || '').toString());
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };

  const maxExistingSeq = orders.reduce((max, o) => {
    const n = parseSeqFromId(o?.id);
    return n && n > max ? n : max;
  }, 0);

  const usedSeq = new Set(
    orders
      .map((o) => parseSeqFromId(o?.id))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9999)
  );

  let seq = Number(meta[metaSeqKey]);
  if (!Number.isFinite(seq) || seq <= 0) seq = maxExistingSeq;

  const findNextAvailableSeq = (start) => {
    const base = Number.isFinite(start) ? start : 1;
    for (let i = 0; i < 9999; i += 1) {
      const candidate = ((base - 1 + i) % 9999) + 1;
      if (!usedSeq.has(candidate)) return candidate;
    }
    return null;
  };

  const nextSeq = findNextAvailableSeq(seq + 1) ?? 9999;
  seq = nextSeq;

  meta[metaSeqKey] = seq;
  const id = `${idPrefix}-${String(seq).padStart(4, '0')}`;

  const order = {
    id,
    ...orderData,
    source: orderData.source || 'order',
    paymentMethod: normalizePaymentMethod(orderData.paymentMethod),
    pointsEarned: calculateOrderPoints(orderData),
    pointsAwarded: false,
    pointsAwardedAt: null,
    status: orderData.status || (orderData.source === 'pos' ? 'completed' : 'pending'),
    createdAt: nowIso(),
  };

  orders.unshift(order);
  saveDb({ ...db, orders, meta });
  runRemoteSync(() => remoteDataService.saveOrder(order));
  return { ...order, _online: true };
};

export const createOrderOnline = async (orderData) => {
  if (!shouldUseRemote()) return createOrder(orderData);

  const usedVoucherCode = (orderData?.voucherCode || '').toString().trim().toUpperCase();
  const usedVoucher = usedVoucherCode ? getVouchers().find((voucher) => voucher.code === usedVoucherCode) : null;
  const order = await remoteDataService.createOrder({
    ...orderData,
    pointsEarned: calculateOrderPoints(orderData),
  });

  const db = ensureDb();
  const orders = Array.isArray(db.orders) ? [...db.orders] : [];
  const existingIdx = orders.findIndex((item) => item.id === order.id);
  if (existingIdx >= 0) orders[existingIdx] = normalizeOrderRecord(order);
  else orders.unshift(normalizeOrderRecord(order));
  saveDb({ ...db, orders });

  const menu = getMenu();
  const qtyById = new Map();
  (order.items || []).forEach((item) => {
    if (!item?.id) return;
    qtyById.set(item.id, (qtyById.get(item.id) || 0) + Number(item.qty || 0));
  });
  if (qtyById.size) {
    const updatedMenu = menu.map((item) => (
      qtyById.has(item.id)
        ? { ...item, sold: Number(item.sold || 0) + Number(qtyById.get(item.id) || 0) }
        : item
    ));
    saveDb({ ...ensureDb(), menu: updatedMenu });
  }

  if (usedVoucherCode && (usedVoucher?.source === 'rewards' || usedVoucher?.userId)) {
    const nextDb = ensureDb();
    const users = sanitizeUsers(nextDb.users || []).map((user) => (
      user.id === nextDb.currentUserId
        ? { ...user, vouchers: (user.vouchers || []).filter((code) => (code || '').toString().toUpperCase() !== usedVoucherCode) }
        : user
    ));
    saveDb({
      ...nextDb,
      users,
      vouchers: getVouchers().filter((voucher) => voucher.code !== usedVoucherCode),
    });
  }

  return order;
};

export const updateOrderStatusOnline = async (orderId, nextStatus) => {
  if (!shouldUseRemote()) return null;
  const result = await remoteDataService.updateOrderStatus(orderId, nextStatus);
  const db = ensureDb();
  const orders = Array.isArray(db.orders) ? [...db.orders] : [];
  const idx = orders.findIndex((order) => order.id === orderId);
  if (idx >= 0) {
    orders[idx] = normalizeOrderRecord({
      ...orders[idx],
      status: result?.status || nextStatus,
      pointsEarned: result?.pointsEarned ?? orders[idx].pointsEarned,
      pointsAwarded: result?.pointsAwarded ?? orders[idx].pointsAwarded,
      pointsAwardedAt: result?.pointsAwardedAt ?? orders[idx].pointsAwardedAt,
      deliveredBy: result?.deliveredBy ?? orders[idx].deliveredBy,
      updatedAt: result?.updatedAt || nowIso(),
    });
    saveDb({ ...db, orders });
  }
  return result;
};

export const updateReservationStatusOnline = async (reservationId, nextStatus) => {
  if (!shouldUseRemote()) return null;
  const result = await remoteDataService.updateReservationStatus(reservationId, nextStatus);
  const db = ensureDb();
  const reservations = Array.isArray(db.reservations) ? [...db.reservations] : [];
  const idx = reservations.findIndex((reservation) => reservation.id === reservationId);
  if (idx >= 0) {
    reservations[idx] = {
      ...reservations[idx],
      status: result?.status || nextStatus,
      pointsEarned: result?.pointsEarned ?? reservations[idx].pointsEarned,
      pointsAwarded: result?.pointsAwarded ?? reservations[idx].pointsAwarded,
      pointsAwardedAt: result?.pointsAwardedAt ?? reservations[idx].pointsAwardedAt,
      updatedAt: result?.updatedAt || nowIso(),
    };
    saveDb({ ...db, reservations });
  }
  return result;
};

export const getUserOrders = (userId) =>
  getOrders().filter(o => o.userId === userId);

export const getOrderById = (id) =>
  getOrders().find(o => o.id === id);

/* ---- Vouchers ---- */
export const getVouchers = () => {
  const db = ensureDb();
  return (db.vouchers || []).map(normalizeVoucher);
};

export const saveVouchers = (vouchers) => {
  const db = ensureDb();
  const normalized = Array.isArray(vouchers) ? vouchers.map(normalizeVoucher) : [];
  saveDb({ ...db, vouchers: normalized });
  runRemoteSync(() => remoteDataService.saveVouchers(normalized));
};

export const deleteVoucherOnline = async (code) => {
  const normalizedCode = (code || '').toString().trim().toUpperCase();
  if (shouldUseRemote()) await remoteDataService.deleteVoucher(normalizedCode);
  saveDb({ ...ensureDb(), vouchers: getVouchers().filter((voucher) => voucher.code !== normalizedCode) });
};

export const validateVoucher = (code, orderTotal) => {
  const normalizedCode = (code || '').toString().trim().toUpperCase();
  const vouchers = getVouchers();
  const v = vouchers.find(v => v.code === normalizedCode);
  if (!v) return { ok: false, msg: 'Mã voucher không tồn tại.' };
  if (!v.active) return { ok: false, msg: 'Mã voucher đã hết hạn.' };
  if (v.source === 'rewards' || v.userId) {
    const user = getCurrentUser();
    const owned = new Set((user?.vouchers || []).map((item) => (item || '').toString().toUpperCase()));
    if (!owned.has(normalizedCode)) return { ok: false, msg: 'Voucher này chỉ dùng được cho tài khoản đã đổi.' };
  }
  const now = new Date();
  const startsAt = v.startsAt ? new Date(v.startsAt) : null;
  const expiresAt = v.expiresAt ? new Date(v.expiresAt) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime()) && now < startsAt) return { ok: false, msg: 'Mã voucher chưa đến thời gian sử dụng.' };
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && now > expiresAt) return { ok: false, msg: 'Mã voucher đã hết hạn.' };
  if (orderTotal < v.minOrder) return { ok: false, msg: `Đơn hàng tối thiểu ${formatPrice(v.minOrder)} để dùng mã này.` };
  const discount = v.type === 'percent'
    ? Math.round(orderTotal * v.value / 100)
    : v.value;
  return { ok: true, voucher: v, discount };
};

const generateVoucherCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const existing = new Set(getVouchers().map((v) => (v.code || '').toString().toUpperCase()));
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '';
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.getRandomValues) {
      const values = new Uint32Array(10);
      cryptoApi.getRandomValues(values);
      code = Array.from(values, (n) => chars[n % chars.length]).join('');
    } else {
      code = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }
    if (!existing.has(code)) return code;
  }
  return `RW${Date.now().toString(36).slice(-8).toUpperCase()}`.slice(0, 10);
};

export const getCurrentUserVouchers = () => {
  const user = getCurrentUser();
  if (!user) return [];
  const owned = new Set((user.vouchers || []).map((code) => (code || '').toString().toUpperCase()));
  return getVouchers().filter((voucher) => owned.has((voucher.code || '').toString().toUpperCase()));
};

const redeemPointsForVoucherLocal = (amount) => {
  const value = Number(amount || 0);
  const user = getCurrentUser();
  if (!user) return { ok: false, msg: 'Vui lòng đăng nhập để đổi voucher.' };
  if (!Number.isFinite(value) || value <= 0 || value % 1000 !== 0) {
    return { ok: false, msg: 'Mệnh giá voucher phải là bội số của 1.000đ.' };
  }

  const requiredPoints = value / 1000;
  if (Number(user.points || 0) < requiredPoints) {
    return { ok: false, msg: `Bạn cần ${requiredPoints.toLocaleString('vi-VN')} điểm để đổi voucher này.` };
  }

  const users = getUsers();
  const userIdx = users.findIndex((u) => u.id === user.id);
  if (userIdx === -1) return { ok: false, msg: 'Không tìm thấy tài khoản khách hàng.' };

  const code = generateVoucherCode();
  const voucher = {
    code,
    type: 'fixed',
    value,
    minOrder: 0,
    startsAt: '',
    expiresAt: '',
    desc: `Voucher đổi từ ${requiredPoints.toLocaleString('vi-VN')} điểm thưởng`,
    active: true,
    source: 'rewards',
    userId: user.id,
    createdAt: nowIso(),
  };

  const nextUser = sanitizeUser({
    ...users[userIdx],
    points: Math.max(0, Number(users[userIdx].points || 0) - requiredPoints),
    vouchers: [...(users[userIdx].vouchers || []), code],
  }, users[userIdx].id);
  users[userIdx] = nextUser;

  const vouchers = getVouchers();
  saveDb({ ...ensureDb(), users: sanitizeUsers(users), vouchers: [...vouchers, voucher] });
  runRemoteSync(() => remoteDataService.saveVouchers([...vouchers, voucher]));
  saveCurrentUser(nextUser);
  return { ok: true, voucher, user: nextUser, pointsSpent: requiredPoints };
};

export const redeemPointsForVoucher = async (amount) => {
  if (!shouldUseRemote()) return redeemPointsForVoucherLocal(amount);

  const value = Number(amount || 0);
  const user = getCurrentUser();
  if (!user) return { ok: false, msg: 'Vui lòng đăng nhập để đổi voucher.' };
  if (!Number.isFinite(value) || value <= 0 || value % 1000 !== 0) {
    return { ok: false, msg: 'Mệnh giá voucher phải là bội số của 1.000đ.' };
  }
  const requiredPoints = value / 1000;
  if (Number(user.points || 0) < requiredPoints) {
    return { ok: false, msg: `Bạn cần ${requiredPoints.toLocaleString('vi-VN')} điểm để đổi voucher này.` };
  }

  try {
    const result = await remoteDataService.redeemPointsForVoucher(value);
    const voucher = normalizeVoucher(result.voucher);
    const users = getUsers();
    const userIdx = users.findIndex((item) => item.id === user.id);
    if (userIdx === -1) throw new Error('Không tìm thấy tài khoản khách hàng.');
    const nextUser = sanitizeUser({
      ...users[userIdx],
      points: Number(result.points || 0),
      vouchers: Array.from(new Set([...(users[userIdx].vouchers || []), voucher.code])),
    }, users[userIdx].id);
    users[userIdx] = nextUser;
    const vouchers = getVouchers();
    saveDb({
      ...ensureDb(),
      users: sanitizeUsers(users),
      vouchers: [...vouchers.filter((item) => item.code !== voucher.code), voucher],
    });
    saveCurrentUser(nextUser);
    return { ok: true, voucher, user: nextUser, pointsSpent: requiredPoints };
  } catch (error) {
    return { ok: false, msg: error?.message || 'Không thể đổi voucher.' };
  }
};

/* ---- Menu ---- */
const ALLOWED_MENU_CATEGORIES = new Set(['ga', 'vit', 'bun', 'mien', 'chao', 'kho']);
const MENU_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

const normalizeMenuCategory = (cat) => {
  const raw = (cat || '').toString().trim().toLowerCase();
  if (!raw) return 'kho';
  if (['ga', 'gà', 'chicken'].includes(raw)) return 'ga';
  if (['vit', 'vịt', 'duck'].includes(raw)) return 'vit';
  if (['bun', 'bún', 'noodle'].includes(raw)) return 'bun';
  if (['mien', 'miến', 'glass noodle'].includes(raw)) return 'mien';
  if (['chao', 'cháo', 'porridge'].includes(raw)) return 'chao';
  if (['kho', 'khô', 'món khô', 'mon kho', 'dry', 'com', 'cơm', 'rice', 'phu', 'món phụ', 'mon phu', 'side', 'uong', 'đồ uống', 'do uong', 'drink', 'nuoc', 'nước'].includes(raw)) return 'kho';
  return 'kho';
};

const slugifyMenuName = (name) =>
  (name || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const inferMenuImagePath = (item) => {
  const slug = slugifyMenuName(item?.name);
  if (!slug) return '';
  return `assets/images/${slug}.${MENU_IMAGE_EXTENSIONS[0]}`;
};

const isMissingMenuImage = (img) => {
  const value = (img || '').toString().trim();
  return !value || value.endsWith('/placeholder.svg') || value === 'placeholder.svg';
};

const normalizeMenuItem = (item, defaultItem = null) => {
  const { badge, available, isNew, ...itemWithoutLegacyFlags } = item || {};
  delete itemWithoutLegacyFlags['is' + 'New'];
  const normalizedCategory = normalizeMenuCategory(item.category);
  const fixedCategory = ALLOWED_MENU_CATEGORIES.has(normalizedCategory) ? normalizedCategory : 'kho';

  const sold = Number.isFinite(Number(item.sold)) ? Number(item.sold) : 0;
  const defaultImage = isMissingMenuImage(defaultItem?.img) ? '' : defaultItem?.img;
  const image = isMissingMenuImage(item.img)
    ? (defaultImage || inferMenuImagePath(item)).toString()
    : item.img.toString();

  const rawStatus = (item.status || '').toString().trim().toLowerCase();
  const status = ['available', 'soldout', 'hidden'].includes(rawStatus)
    ? rawStatus
    : available === false ? 'soldout' : 'available';

  return {
    ...itemWithoutLegacyFlags,
    category: fixedCategory,
    desc: (item.desc || '').toString(),
    img: image,
    status,
    sold,
  };
};

export const getMenu = () => {
  const db = ensureDb();
  const stored = Array.isArray(db.menu) ? db.menu : [];
  const normalized = stored.map((item) => normalizeMenuItem(item));
  if (stored.length !== normalized.length || stored.some((item, idx) => JSON.stringify(item) !== JSON.stringify(normalized[idx]))) {
    saveDb({ ...db, menu: normalized });
  }
  return normalized;
};
export const saveMenu = (menu) => {
  const db = ensureDb();
  const normalized = Array.isArray(menu) ? menu.map((item) => normalizeMenuItem(item)).filter((item) => ALLOWED_MENU_CATEGORIES.has(item.category)) : [];
  saveDb({ ...db, menu: normalized });
  runRemoteSync(() => remoteDataService.saveMenu(normalized));
};

export const deleteMenuItemOnline = async (id) => {
  if (shouldUseRemote()) await remoteDataService.deleteMenuItem(id);
  saveDb({ ...ensureDb(), menu: getMenu().filter((item) => item.id !== id) });
};

export const incrementMenuSoldCounts = (orderItems = []) => {
  const menu = getMenu();
  const qtyById = new Map();
  (orderItems || []).forEach((it) => {
    const id = it?.id;
    const qty = Number(it?.qty || 0);
    if (!id || !Number.isFinite(qty) || qty <= 0) return;
    qtyById.set(id, (qtyById.get(id) || 0) + qty);
  });

  if (!qtyById.size) return menu;

  const updated = menu.map((m) => {
    const inc = qtyById.get(m.id) || 0;
    if (!inc) return m;
    return { ...m, sold: (Number(m.sold) || 0) + inc };
  });
  saveMenu(updated);
  return updated;
};

/* ---- Reservations (Preorder) ---- */
export const getReservations = () => {
  const db = ensureDb();
  return Array.isArray(db.reservations) ? db.reservations : [];
};

export const saveReservations = (reservations) => {
  const db = ensureDb();
  const normalized = Array.isArray(reservations) ? reservations : [];
  saveDb({ ...db, reservations: normalized });
  runRemoteSync(() => remoteDataService.saveReservations(normalized));
};

export const createReservation = (data = {}) => {
  const db = ensureDb();

  const parseSeqFromId = (id) => {
    const m = /^RES-(\d{4})$/.exec((id || '').toString());
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };

  const existing = Array.isArray(db.reservations) ? db.reservations : [];
  const usedSeq = new Set(
    existing
      .map((r) => parseSeqFromId(r?.id))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9999)
  );

  const maxExistingSeq = existing.reduce((max, r) => {
    const n = parseSeqFromId(r?.id);
    return n && n > max ? n : max;
  }, 0);

  const meta = { ...(db.meta || {}) };
  let seq = Number(meta.reservationSeq);
  if (!Number.isFinite(seq) || seq <= 0) seq = maxExistingSeq;

  const findNextAvailableSeq = (start) => {
    const base = Number.isFinite(start) ? start : 1;
    for (let i = 0; i < 9999; i += 1) {
      const candidate = ((base - 1 + i) % 9999) + 1;
      if (!usedSeq.has(candidate)) return candidate;
    }
    return null;
  };

  const nextSeq = findNextAvailableSeq(seq + 1) ?? 9999;
  seq = nextSeq;
  meta.reservationSeq = seq;

  const qty = Number(data?.qty || 1);
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
  const price = Number(data?.price || 0);
  const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;
  const total = Number(data?.total);
  const safeTotal = Number.isFinite(total) && total >= 0 ? total : safePrice * safeQty;

  const reservation = {
    id: `RES-${String(seq).padStart(4, '0')}`,
    userId: data?.userId ? data.userId.toString() : null,
    name: (data?.name || '').toString().trim(),
    phone: (data?.phone || '').toString().trim(),
    type: (data?.type || '').toString(),
    itemName: (data?.itemName || '').toString().trim() || null,
    qty: safeQty,
    price: safePrice,
    total: safeTotal,
    date: (data?.date || '').toString(),
    note: (data?.note || '').toString().trim(),
    status: 'pending',
    staffCreated: Boolean(data?.staffCreated),
    pointsEarned: data?.staffCreated ? 0 : calculateOrderPoints(safeTotal),
    pointsAwarded: false,
    pointsAwardedAt: null,
    createdAt: nowIso(),
  };

  const reservations = [...existing, reservation];
  saveDb({ ...db, meta, reservations });
  runRemoteSync(() => remoteDataService.createReservation(reservation));
  return reservation;
};

export const createReservationOnline = async (data = {}) => {
  if (!shouldUseRemote()) return createReservation(data);
  const reservation = await remoteDataService.createReservation(data);
  const db = ensureDb();
  const reservations = Array.isArray(db.reservations) ? [...db.reservations] : [];
  const idx = reservations.findIndex((item) => item.id === reservation.id);
  if (idx >= 0) reservations[idx] = reservation;
  else reservations.push(reservation);
  saveDb({ ...db, reservations });
  return reservation;
};

export const migrateLocalDataToOnline = async () => {
  if (!shouldUseRemote()) {
    return { ok: false, msg: 'Supabase chưa được cấu hình.' };
  }

  const user = getCurrentUser();
  const result = {
    ok: true,
    cartItems: 0,
    orders: 0,
    reservations: 0,
    menuItems: 0,
    vouchers: 0,
  };

  try {
    const cart = getCart();
    if (cart.length) {
      await remoteDataService.saveCart(cart);
      result.cartItems = cart.length;
    }

    const userOrders = user?.id ? getOrders().filter((order) => order.userId === user.id) : [];
    for (const order of userOrders) {
      await remoteDataService.saveOrder(order);
    }
    result.orders = userOrders.length;

    const userReservations = user?.id
      ? getReservations().filter((reservation) => reservation.userId === user.id)
      : [];
    for (const reservation of userReservations) {
      await remoteDataService.createReservation(reservation);
    }
    result.reservations = userReservations.length;

    const profile = await remoteDataService.getCurrentProfile().catch(() => null);
    if (['owner', 'staff'].includes(profile?.role)) {
      const menu = getMenu();
      const vouchers = getVouchers();
      await remoteDataService.saveMenu(menu);
      await remoteDataService.saveVouchers(vouchers);
      result.menuItems = menu.length;
      result.vouchers = vouchers.length;
    }

    const db = ensureDb();
    saveDb({
      ...db,
      meta: {
        ...(db.meta || {}),
        migratedLocalDataToOnlineAt: nowIso(),
      },
    });
    return result;
  } catch (error) {
    return {
      ...result,
      ok: false,
      msg: error?.message || 'Không thể migrate dữ liệu local lên online.',
      error,
    };
  }
};

export const getLocalMigrationSummary = () => {
  const db = ensureDb();
  const user = getCurrentUser();
  const migratedAt = db?.meta?.migratedLocalDataToOnlineAt;
  const cartItems = getCart().length;
  const orders = user?.id ? getOrders().filter((order) => order.userId === user.id).length : 0;
  const reservations = user?.id ? getReservations().filter((reservation) => reservation.userId === user.id).length : 0;
  const profileRole = user?.role || 'customer';
  const menuItems = ['owner', 'staff'].includes(profileRole) ? getMenu().length : 0;
  const vouchers = ['owner', 'staff'].includes(profileRole) ? getVouchers().length : 0;
  const total = cartItems + orders + reservations + menuItems + vouchers;

  return {
    hasData: total > 0,
    migratedAt,
    cartItems,
    orders,
    reservations,
    menuItems,
    vouchers,
    total,
  };
};

/* ---- Utils ---- */
export const formatPrice = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const generateOrderCode = () =>
  (() => {
    const db = ensureDb();
    const orders = Array.isArray(db.orders) ? db.orders : [];
    const meta = db.meta || {};

    const parseSeqFromId = (id) => {
      const m = /^ORD-(\d{4})$/.exec((id || '').toString());
      if (!m) return null;
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : null;
    };

    const usedSeq = new Set(
      orders
        .map((o) => parseSeqFromId(o?.id))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9999)
    );

    const maxExistingSeq = orders.reduce((max, o) => {
      const n = parseSeqFromId(o?.id);
      return n && n > max ? n : max;
    }, 0);

    let seq = Number(meta.orderSeq);
    if (!Number.isFinite(seq) || seq <= 0) seq = maxExistingSeq;

    const findNextAvailableSeq = (start) => {
      const base = Number.isFinite(start) ? start : 1;
      for (let i = 0; i < 9999; i += 1) {
        const candidate = ((base - 1 + i) % 9999) + 1;
        if (!usedSeq.has(candidate)) return candidate;
      }
      return null;
    };

    const nextSeq = findNextAvailableSeq(seq + 1) ?? 9999;
    return `ORD-${String(nextSeq).padStart(4, '0')}`;
  })();
