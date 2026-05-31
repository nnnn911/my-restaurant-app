import { requireSupabase } from './supabaseClient.js';

const mapMenuItem = (row = {}) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  price: Number(row.price || 0),
  desc: row.description || '',
  img: row.image_path || 'assets/images/placeholder.svg',
  status: row.status || 'available',
  sold: Number(row.sold || 0),
});

const mapVoucher = (row = {}) => ({
  code: row.code,
  type: row.type,
  value: Number(row.value || 0),
  minOrder: Number(row.min_order || 0),
  desc: row.description || '',
  active: Boolean(row.active),
  startsAt: row.starts_at || '',
  expiresAt: row.expires_at || '',
  source: row.source || '',
  userId: row.owner_user_id || null,
  createdAt: row.created_at || '',
});

const mapProfile = (row = {}) => ({
  id: row.public_code || row.id,
  authId: row.id,
  name: row.name || '',
  phone: row.phone || '',
  points: Number(row.points || 0),
  role: row.role || 'customer',
  createdAt: row.created_at || '',
});

const mapStaffActor = (row = {}) => ({
  id: row.public_code || row.id,
  authId: row.authId || row.id,
  name: row.name || '',
  phone: row.phone || '',
  salaryVnd: Number(row.salaryVnd ?? row.salary_vnd ?? 0),
  role: row.role || 'staff',
  createdAt: row.createdAt || row.created_at || '',
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resolveStaffActorAuthId = async (client, actor = {}) => {
  if (actor.authId && UUID_RE.test(actor.authId)) return actor.authId;
  const lookupId = (actor.authId || actor.id || '').toString().trim();
  if (!lookupId) throw new Error('Không tìm thấy tài khoản nhân viên.');
  const query = client
    .from('profile_details')
    .select('id, public_code, role')
    .in('role', ['staff', 'shipper'])
    .limit(1);
  const { data, error } = UUID_RE.test(lookupId)
    ? await query.eq('id', lookupId).maybeSingle()
    : await query.eq('public_code', lookupId).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Không tìm thấy nhân viên.');
  return data.id;
};

const resolveCustomerAuthId = async (client, user = {}) => {
  if (user.authId && UUID_RE.test(user.authId)) return user.authId;
  const lookupId = (user.authId || user.id || '').toString().trim();
  if (!lookupId) throw new Error('Không tìm thấy tài khoản khách hàng.');
  const query = client
    .from('profile_details')
    .select('id, public_code, role')
    .eq('role', 'customer')
    .limit(1);
  const { data, error } = UUID_RE.test(lookupId)
    ? await query.eq('id', lookupId).maybeSingle()
    : await query.eq('public_code', lookupId).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Không tìm thấy khách hàng.');
  return data.id;
};

const mapMonthlyCost = (row = {}) => ({
  id: row.id || row.month,
  month: row.month || '',
  electricity: Number(row.electricity || 0),
  water: Number(row.water || 0),
  rent: Number(row.rent || 0),
  ingredients: Number(row.ingredients || 0),
  staffSalary: Number(row.staff_salary ?? row.staffSalary ?? 0),
  note: row.note || '',
  createdAt: row.created_at || row.createdAt || '',
  updatedAt: row.updated_at || row.updatedAt || '',
});

const mapOrderItem = (row = {}) => ({
  id: row.menu_item_id || row.id,
  name: row.name || '',
  price: Number(row.price || 0),
  qty: Number(row.quantity || 0),
  note: row.note || '',
  category: row.category || undefined,
});

const mapOrder = (row = {}) => ({
  id: row.id,
  userId: row.profile?.public_code || row.user_profile?.public_code || row.user_id || 'guest',
  customerName: row.customer_name || '',
  customerPhone: row.customer_phone || '',
  address: row.address || '',
  note: row.note || '',
  paymentMethod: row.payment_method || 'cash',
  items: (row.order_items || []).map(mapOrderItem),
  subtotal: Number(row.subtotal || 0),
  discount: Number(row.discount || 0),
  total: Number(row.total || 0),
  voucherCode: row.voucher_code || null,
  source: row.source || 'order',
  pointsEarned: Number(row.points_earned || 0),
  pointsAwarded: Boolean(row.points_awarded),
  pointsAwardedAt: row.points_awarded_at || null,
  status: row.status || 'pending',
  deliveredBy: row.delivered_by_profile?.public_code || row.delivered_by || null,
  updatedAt: row.updated_at || '',
  createdAt: row.created_at || '',
});

const mapPosOrder = (row = {}) => ({
  id: row.id,
  userId: row.staff_profile?.public_code || row.staff_id || 'staff',
  customerName: row.customer_name || 'Khách tại quán',
  customerPhone: row.customer_phone || '',
  address: 'Tại quán',
  note: row.note || '',
  paymentMethod: row.payment_method || 'cash',
  items: (row.pos_order_items || []).map(mapOrderItem),
  subtotal: Number(row.subtotal || 0),
  discount: Number(row.discount || 0),
  total: Number(row.total || 0),
  voucherCode: null,
  source: 'pos',
  pointsEarned: 0,
  pointsAwarded: false,
  pointsAwardedAt: null,
  status: row.status || 'completed',
  deliveredBy: null,
  updatedAt: row.updated_at || '',
  createdAt: row.created_at || '',
});

const mapReservation = (row = {}) => ({
  id: row.id,
  userId: row.profile?.public_code || row.user_profile?.public_code || row.user_id || null,
  name: row.name || '',
  phone: row.phone || '',
  type: row.type || '',
  itemName: row.item_name || null,
  qty: Number(row.quantity || 1),
  price: Number(row.price || 0),
  total: Number(row.total || 0),
  date: row.needed_date || '',
  note: row.note || '',
  status: row.status || 'pending',
  staffCreated: Boolean(row.staff_created),
  pointsEarned: Number(row.points_earned || 0),
  pointsAwarded: Boolean(row.points_awarded),
  pointsAwardedAt: row.points_awarded_at || null,
  updatedAt: row.updated_at || '',
  createdAt: row.created_at || '',
});

const mapRpcOrder = (row = {}) => ({
  id: row.id,
  userId: row.userId || 'guest',
  customerName: row.customerName || '',
  customerPhone: row.customerPhone || '',
  address: row.address || '',
  note: row.note || '',
  paymentMethod: row.paymentMethod || 'cash',
  items: Array.isArray(row.items) ? row.items : [],
  subtotal: Number(row.subtotal || 0),
  discount: Number(row.discount || 0),
  total: Number(row.total || 0),
  voucherCode: row.voucherCode || null,
  source: row.source || 'order',
  pointsEarned: Number(row.pointsEarned || 0),
  pointsAwarded: Boolean(row.pointsAwarded),
  pointsAwardedAt: row.pointsAwardedAt || null,
  status: row.status || 'pending',
  deliveredBy: row.deliveredBy || null,
  updatedAt: row.updatedAt || '',
  createdAt: row.createdAt || '',
});

const mapRpcReservation = (row = {}) => ({
  id: row.id,
  userId: row.userId || null,
  name: row.name || '',
  phone: row.phone || '',
  type: row.type || '',
  itemName: row.itemName || null,
  qty: Number(row.qty || 1),
  price: Number(row.price || 0),
  total: Number(row.total || 0),
  date: row.date || '',
  note: row.note || '',
  status: row.status || 'pending',
  staffCreated: Boolean(row.staffCreated),
  pointsEarned: Number(row.pointsEarned || 0),
  pointsAwarded: Boolean(row.pointsAwarded),
  pointsAwardedAt: row.pointsAwardedAt || null,
  createdAt: row.createdAt || '',
});

const toVoucherRow = (voucher = {}) => ({
  code: (voucher.code || '').toString().trim().toUpperCase(),
  type: voucher.type === 'percent' ? 'percent' : 'fixed',
  value: Number(voucher.value || 0),
  min_order: Number(voucher.minOrder || 0),
  description: (voucher.desc || '').toString(),
  active: Boolean(voucher.active),
  starts_at: toTimestamptzValue(voucher.startsAt),
  expires_at: toTimestamptzValue(voucher.expiresAt),
  source: voucher.source || null,
});

const toMenuRow = (item = {}, sortOrder = 0) => ({
  id: item.id,
  name: item.name,
  category: item.category || 'kho',
  price: Number(item.price || 0),
  description: item.desc || '',
  image_path: item.img || 'assets/images/placeholder.svg',
  status: item.status || 'available',
  sold: Number(item.sold || 0),
  sort_order: sortOrder,
});

const toMonthlyCostRow = (cost = {}) => ({
  month: (cost.month || '').toString().slice(0, 7),
  electricity: Math.max(0, Number(cost.electricity || 0)),
  water: Math.max(0, Number(cost.water || 0)),
  rent: Math.max(0, Number(cost.rent || 0)),
  ingredients: Math.max(0, Number(cost.ingredients || 0)),
  staff_salary: Math.max(0, Number(cost.staffSalary ?? cost.staff_salary ?? 0)),
  note: (cost.note || '').toString(),
});

const normalizePaymentMethod = (method) => {
  const value = (method || 'cash').toString();
  return value === 'transfer' ? 'bank' : value;
};

const toTimestamptzValue = (value) => {
  const raw = (value || '').toString().trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? raw : date.toISOString();
  }
  return raw;
};

const phoneToAuthEmail = (phone = '') =>
  `${phone.toString().replace(/\D/g, '')}@phone.dongque.app`;

export const remoteDataService = {
  async getSession() {
    const client = requireSupabase();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async signUpCustomer({ name, phone, password }) {
    const client = requireSupabase();
    const email = phoneToAuthEmail(phone);
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { name, phone, role: 'customer' } },
    });
    if (error) throw error;
    return data;
  },

  async signInWithPhonePassword(phone, password) {
    const client = requireSupabase();
    const email = phoneToAuthEmail(phone);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },

  async getCurrentProfile() {
    const client = requireSupabase();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    const userId = userData?.user?.id;
    if (!userId) return null;

    const { data, error } = await client
      .from('profile_details')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return mapProfile(data);
  },

  async getUsers() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('profile_details')
      .select('*')
      .eq('role', 'customer')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapProfile);
  },

  async createCustomer(user = {}) {
    const client = requireSupabase();
    const { data, error } = await client.rpc('owner_create_customer_user', {
      payload: {
        name: user.name || '',
        phone: user.phone || '',
        password: user.password || '',
        points: Number(user.points || 0),
      },
    });
    if (error) throw error;
    return mapProfile({
      id: data?.authId || data?.id,
      public_code: data?.id,
      name: data?.name,
      phone: data?.phone,
      points: data?.points || user.points || 0,
      role: 'customer',
      created_at: data?.createdAt,
    });
  },

  async updateCustomer(user = {}) {
    const client = requireSupabase();
    const customerAuthId = await resolveCustomerAuthId(client, user);
    const { data, error } = await client.rpc('owner_update_customer_user', {
      customer_id: customerAuthId,
      payload: {
        name: user.name || '',
        phone: user.phone || '',
        points: Number(user.points || 0),
      },
    });
    if (error) throw error;
    return mapProfile({
      id: data?.authId || data?.id,
      public_code: data?.id,
      name: data?.name,
      phone: data?.phone,
      points: data?.points || user.points || 0,
      role: 'customer',
      created_at: data?.createdAt,
    });
  },

  async getStaffActors() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('profile_details')
      .select('*')
      .in('role', ['staff', 'shipper'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapStaffActor);
  },

  async createStaffActor(actor = {}) {
    const client = requireSupabase();
    const { data, error } = await client.rpc('owner_create_actor_user', {
      payload: {
        name: actor.name || '',
        phone: actor.phone || '',
        role: actor.role || 'staff',
        password: actor.password || '',
        salaryVnd: Number(actor.salaryVnd || 0),
      },
    });
    if (error) throw error;
    return mapStaffActor(data);
  },

  async updateStaffActor(actor = {}) {
    const client = requireSupabase();
    const actorAuthId = await resolveStaffActorAuthId(client, actor);
    const { data, error } = await client.rpc('owner_update_actor_user', {
      actor_id: actorAuthId,
      payload: {
        name: actor.name || '',
        phone: actor.phone || '',
        role: actor.role || 'staff',
        password: actor.password || '',
        salaryVnd: Number(actor.salaryVnd || 0),
      },
    });
    if (error) throw error;
    return mapStaffActor(data);
  },

  async deleteStaffActor(actor = {}) {
    const client = requireSupabase();
    const actorAuthId = await resolveStaffActorAuthId(client, actor);
    const { data, error } = await client.rpc('owner_delete_actor_user', { actor_id: actorAuthId });
    if (error) throw error;
    return mapStaffActor(data);
  },

  async getMonthlyCosts() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('monthly_costs')
      .select('*')
      .order('month', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapMonthlyCost);
  },

  async saveMonthlyCost(cost = {}) {
    const client = requireSupabase();
    const row = toMonthlyCostRow(cost);
    const { data, error } = await client
      .from('monthly_costs')
      .upsert(row, { onConflict: 'month' })
      .select('*')
      .single();
    if (error) throw error;
    return mapMonthlyCost(data);
  },

  async deleteMonthlyCost(month) {
    const client = requireSupabase();
    const { error } = await client.from('monthly_costs').delete().eq('month', (month || '').toString().slice(0, 7));
    if (error) throw error;
  },

  async saveUsers(users = []) {
    const client = requireSupabase();
    const validUsers = (Array.isArray(users) ? users : []).filter((user) => user.authId);
    const profileRows = validUsers
      .map((user) => ({
        id: user.authId,
        public_code: user.id,
        role: user.role || 'customer',
      }));
    const customerRows = validUsers
      .filter((user) => (user.role || 'customer') === 'customer')
      .filter((user) => user.authId)
      .map((user) => ({
        id: user.authId,
        name: user.name || 'Khách hàng',
        phone: user.phone || null,
        points: Number(user.points || 0),
      }));
    if (!profileRows.length) return;
    const { error: profileError } = await client.from('profiles').upsert(profileRows, { onConflict: 'id' });
    if (profileError) throw profileError;
    if (customerRows.length) {
      const { error: customerError } = await client.from('customer_profiles').upsert(customerRows, { onConflict: 'id' });
      if (customerError) throw customerError;
    }
  },

  async updateCurrentProfile(updates = {}) {
    const client = requireSupabase();
    const profile = await this.getCurrentProfile();
    if (!profile?.authId) throw new Error('Không tìm thấy tài khoản hiện tại.');
    const row = {
      name: updates.name || profile.name || 'Khách hàng',
      phone: updates.phone || profile.phone || null,
    };
    let error;
    if (profile.role === 'staff') {
      ({ error } = await client.from('staff_profiles').update(row).eq('id', profile.authId));
    } else if (profile.role === 'owner') {
      ({ error } = await client.from('owner_profiles').update(row).eq('id', profile.authId));
    } else if (profile.role === 'shipper') {
      ({ error } = await client.from('shipper_profiles').update(row).eq('id', profile.authId));
    } else {
      ({ error } = await client.from('customer_profiles').update(row).eq('id', profile.authId));
    }
    if (error) throw error;
    return this.getCurrentProfile();
  },

  async updateUserPoints(publicCode, points) {
    const client = requireSupabase();
    const nextPoints = Math.max(0, Number(points || 0));
    const { data: profile, error: profileError } = await client
      .from('profile_details')
      .select('*')
      .eq('public_code', publicCode)
      .eq('role', 'customer')
      .single();
    if (profileError) throw profileError;
    const { data, error } = await client
      .from('customer_profiles')
      .update({ points: nextPoints })
      .eq('id', profile.id)
      .select('points')
      .single();
    if (error) throw error;
    return mapProfile({ ...profile, points: data.points });
  },

  async getCurrentUserVoucherCodes() {
    const client = requireSupabase();
    const profile = await this.getCurrentProfile();
    if (!profile?.authId) return [];
    const { data, error } = await client
      .from('user_vouchers')
      .select('voucher_code')
      .eq('user_id', profile.authId);
    if (error) throw error;
    return (data || []).map((row) => (row.voucher_code || '').toString().toUpperCase()).filter(Boolean);
  },

  async redeemPointsForVoucher(amount) {
    const client = requireSupabase();
    const { data, error } = await client.rpc('redeem_points_for_voucher', { voucher_amount: Number(amount || 0) });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      voucher: mapVoucher({
        code: row?.code,
        type: row?.type,
        value: row?.value,
        min_order: row?.min_order,
        description: row?.description,
        active: row?.active,
        starts_at: row?.starts_at,
        expires_at: row?.expires_at,
        source: row?.source,
        owner_user_id: row?.owner_user_id,
        created_at: row?.created_at,
      }),
      points: Number(row?.points || 0),
    };
  },

  async waitForCurrentProfile({ retries = 8, delayMs = 250 } = {}) {
    let lastError = null;
    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        const profile = await this.getCurrentProfile();
        if (profile) return profile;
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    if (lastError) throw lastError;
    return null;
  },

  async getMenu() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('menu_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapMenuItem);
  },

  async saveMenu(menu = []) {
    const client = requireSupabase();
    const rows = (Array.isArray(menu) ? menu : []).map(toMenuRow);
    const { error } = await client.from('menu_items').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  },

  async deleteMenuItem(id) {
    const client = requireSupabase();
    const { error } = await client.from('menu_items').delete().eq('id', id);
    if (error) throw error;
  },

  async getVouchers() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('vouchers')
      .select('*')
      .order('code', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapVoucher);
  },

  async saveVouchers(vouchers = []) {
    const client = requireSupabase();
    const rows = (Array.isArray(vouchers) ? vouchers : []).map(toVoucherRow).filter((v) => v.code);
    const { error } = await client.from('vouchers').upsert(rows, { onConflict: 'code' });
    if (error) throw error;
  },

  async deleteVoucher(code) {
    const client = requireSupabase();
    const { error } = await client.from('vouchers').delete().eq('code', (code || '').toString().toUpperCase());
    if (error) throw error;
  },

  async deleteCustomer(publicCode) {
    const client = requireSupabase();
    const { error } = await client
      .from('profiles')
      .delete()
      .eq('public_code', publicCode)
      .eq('role', 'customer');
    if (error) throw error;
  },

  async getCart() {
    const client = requireSupabase();
    const profile = await this.getCurrentProfile();
    if (!profile?.authId) return [];

    const { data: cart, error: cartError } = await client
      .from('carts')
      .select('id')
      .eq('user_id', profile.authId)
      .maybeSingle();
    if (cartError) throw cartError;
    if (!cart?.id) return [];

    const { data, error } = await client
      .from('cart_items')
      .select('id, quantity, note, menu_item:menu_items(*)')
      .eq('cart_id', cart.id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return (data || []).map((row) => ({
      ...mapMenuItem(row.menu_item || {}),
      qty: Number(row.quantity || 0),
      note: row.note || '',
      cartId: row.id,
    }));
  },

  async saveCart(cartItems = []) {
    const client = requireSupabase();
    const profile = await this.getCurrentProfile();
    if (!profile?.authId) return;

    const { data: cart, error: cartError } = await client
      .from('carts')
      .upsert({ user_id: profile.authId }, { onConflict: 'user_id' })
      .select('id')
      .single();
    if (cartError) throw cartError;

    const { error: deleteError } = await client
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id);
    if (deleteError) throw deleteError;

    const rows = (Array.isArray(cartItems) ? cartItems : [])
      .filter((item) => item?.id && Number(item.qty || 0) > 0)
      .map((item) => ({
        cart_id: cart.id,
        menu_item_id: item.id,
        quantity: Number(item.qty || 1),
        note: (item.note || '').toString().trim(),
      }));

    if (!rows.length) return;
    const { error } = await client.from('cart_items').insert(rows);
    if (error) throw error;
  },

  async getOrders() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('orders')
      .select('*, profile:profiles!orders_user_id_fkey(public_code), delivered_by_profile:profiles!orders_delivered_by_fkey(public_code), order_items(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const { data: posData, error: posError } = await client
      .from('pos_orders')
      .select('*, staff_profile:profiles!pos_orders_staff_id_fkey(public_code), pos_order_items(*)')
      .order('created_at', { ascending: false });
    const posOrders = posError ? [] : (posData || []).map(mapPosOrder);

    return [
      ...(data || []).map(mapOrder),
      ...posOrders,
    ].sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
  },

  async createOrder(orderData = {}) {
    const client = requireSupabase();
    const payload = {
      ...orderData,
      paymentMethod: normalizePaymentMethod(orderData.paymentMethod),
      items: (orderData.items || []).map((item) => ({
        id: item.id || null,
        name: item.name || 'Món',
        price: Number(item.price || 0),
        qty: Number(item.qty || 1),
        note: item.note || '',
        category: item.category || null,
      })),
    };
    const rpcName = payload.source === 'pos' ? 'create_pos_order' : 'create_order';
    const { data, error } = await client.rpc(rpcName, { payload });
    if (error) throw error;
    return mapRpcOrder(data || {});
  },

  async saveOrder(order = {}) {
    const client = requireSupabase();
    if ((order.source || '').toString() === 'pos') {
      const orderRow = {
        id: order.id,
        customer_name: order.customerName || 'Khách tại quán',
        customer_phone: order.customerPhone || '',
        note: order.note || '',
        payment_method: normalizePaymentMethod(order.paymentMethod),
        subtotal: Number(order.subtotal || 0),
        discount: Number(order.discount || 0),
        total: Number(order.total || 0),
        status: order.status || 'completed',
      };
      const { error: orderError } = await client.from('pos_orders').upsert(orderRow, { onConflict: 'id' });
      if (orderError) throw orderError;
      const { error: deleteError } = await client.from('pos_order_items').delete().eq('pos_order_id', order.id);
      if (deleteError) throw deleteError;
      const rows = (order.items || []).map((item) => ({
        pos_order_id: order.id,
        menu_item_id: item.id || null,
        name: item.name || 'Món',
        price: Number(item.price || 0),
        quantity: Number(item.qty || 1),
        note: item.note || '',
        category: item.category || null,
      }));
      if (!rows.length) return;
      const { error } = await client.from('pos_order_items').insert(rows);
      if (error) throw error;
      return;
    }

    const profile = await this.getCurrentProfile();
    const orderRow = {
      id: order.id,
      user_id: profile?.authId || null,
      customer_name: order.customerName || 'Khách hàng',
      customer_phone: order.customerPhone || '',
      address: order.address || '',
      note: order.note || '',
      payment_method: normalizePaymentMethod(order.paymentMethod),
      subtotal: Number(order.subtotal || 0),
      discount: Number(order.discount || 0),
      total: Number(order.total || 0),
      voucher_code: order.voucherCode || null,
      source: order.source || 'order',
      status: order.status || 'pending',
      points_earned: Number(order.pointsEarned || 0),
      points_awarded: Boolean(order.pointsAwarded),
      points_awarded_at: order.pointsAwardedAt || null,
    };

    const { error: orderError } = await client.from('orders').upsert(orderRow, { onConflict: 'id' });
    if (orderError) throw orderError;

    const { error: deleteError } = await client.from('order_items').delete().eq('order_id', order.id);
    if (deleteError) throw deleteError;

    const rows = (order.items || []).map((item) => ({
      order_id: order.id,
      menu_item_id: item.id || null,
      name: item.name || 'Món',
      price: Number(item.price || 0),
      quantity: Number(item.qty || 1),
      note: item.note || '',
      category: item.category || null,
    }));
    if (!rows.length) return;
    const { error } = await client.from('order_items').insert(rows);
    if (error) throw error;
  },

  async saveOrders(orders = []) {
    const client = requireSupabase();
    const normalOrders = (Array.isArray(orders) ? orders : []).filter((order) => (order.source || '').toString() !== 'pos');
    const posOrders = (Array.isArray(orders) ? orders : []).filter((order) => (order.source || '').toString() === 'pos');
    const rows = normalOrders.map((order) => ({
      id: order.id,
      customer_name: order.customerName || 'Khách hàng',
      customer_phone: order.customerPhone || '',
      address: order.address || '',
      note: order.note || '',
      payment_method: normalizePaymentMethod(order.paymentMethod),
      subtotal: Number(order.subtotal || 0),
      discount: Number(order.discount || 0),
      total: Number(order.total || 0),
      voucher_code: order.voucherCode || null,
      source: order.source || 'order',
      status: order.status || 'pending',
      points_earned: Number(order.pointsEarned || 0),
      points_awarded: Boolean(order.pointsAwarded),
      points_awarded_at: order.pointsAwardedAt || null,
    }));
    if (rows.length) {
      const { error } = await client.from('orders').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
    for (const order of posOrders) await this.saveOrder(order);
  },

  async updateOrderStatus(orderId, nextStatus) {
    const client = requireSupabase();
    const isPos = /^POS-/.test((orderId || '').toString());
    const { data, error } = await client.rpc(isPos ? 'update_pos_order_status' : 'update_order_status', {
      order_id: orderId,
      next_status: nextStatus,
    });
    if (error) throw error;
    return data;
  },

  async updateReservationStatus(reservationId, nextStatus) {
    const client = requireSupabase();
    const { data, error } = await client.rpc('update_reservation_status', {
      reservation_id: reservationId,
      next_status: nextStatus,
    });
    if (error) throw error;
    return data;
  },

  async getReservations() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('reservations')
      .select('*, profile:profiles!reservations_user_id_fkey(public_code)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapReservation);
  },

  async createReservation(data = {}) {
    const client = requireSupabase();
    const { data: reservation, error } = await client.rpc('create_reservation', { payload: data });
    if (error) throw error;
    return mapRpcReservation(reservation || {});
  },

  async saveReservations(reservations = []) {
    const client = requireSupabase();
    const rows = (Array.isArray(reservations) ? reservations : []).map((item) => ({
      id: item.id,
      name: item.name || '',
      phone: item.phone || '',
      type: item.type || '',
      item_name: item.itemName || null,
      quantity: Number(item.qty || 1),
      price: Number(item.price || 0),
      total: Number(item.total || 0),
      needed_date: item.date,
      note: item.note || '',
      status: item.status || 'pending',
      staff_created: Boolean(item.staffCreated),
      points_earned: Number(item.pointsEarned || 0),
      points_awarded: Boolean(item.pointsAwarded),
      points_awarded_at: item.pointsAwardedAt || null,
    }));
    if (!rows.length) return;
    const { error } = await client.from('reservations').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  },

  subscribeBusinessChanges(onChange) {
    const client = requireSupabase();
    const channel = client
      .channel(`business-changes-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_orders' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_order_items' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_costs' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, onChange)
      .subscribe();

    return () => client.removeChannel(channel);
  },
};
