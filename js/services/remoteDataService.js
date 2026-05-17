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
  status: row.status || 'paid',
  deliveredBy: row.delivered_by_profile?.public_code || row.delivered_by || null,
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
  status: row.status || 'paid',
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
  createdAt: row.createdAt || '',
});

const toVoucherRow = (voucher = {}) => ({
  code: (voucher.code || '').toString().trim().toUpperCase(),
  type: voucher.type === 'percent' ? 'percent' : 'fixed',
  value: Number(voucher.value || 0),
  min_order: Number(voucher.minOrder || 0),
  description: (voucher.desc || '').toString(),
  active: Boolean(voucher.active),
  starts_at: voucher.startsAt || null,
  expires_at: voucher.expiresAt || null,
  source: voucher.source || null,
});

const toMenuRow = (item = {}, sortOrder = 0) => ({
  id: item.id,
  name: item.name,
  category: item.category || 'com',
  price: Number(item.price || 0),
  description: item.desc || '',
  image_path: item.img || 'assets/images/placeholder.svg',
  status: item.status || 'available',
  sold: Number(item.sold || 0),
  sort_order: sortOrder,
});

const normalizePaymentMethod = (method) => {
  const value = (method || 'cash').toString();
  return value === 'transfer' ? 'bank' : value;
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
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return mapProfile(data);
  },

  async getUsers() {
    const client = requireSupabase();
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('role', 'customer')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapProfile);
  },

  async saveUsers(users = []) {
    const client = requireSupabase();
    const rows = (Array.isArray(users) ? users : [])
      .filter((user) => user.authId)
      .map((user) => ({
        id: user.authId,
        public_code: user.id,
        role: user.role || 'customer',
        name: user.name || 'Khách hàng',
        phone: user.phone || null,
        points: Number(user.points || 0),
      }));
    if (!rows.length) return;
    const { error } = await client.from('profiles').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
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
    return (data || []).map(mapOrder);
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
    const { data, error } = await client.rpc('create_order', { payload });
    if (error) throw error;
    return mapRpcOrder(data || {});
  },

  async saveOrder(order = {}) {
    const client = requireSupabase();
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
      status: order.status || 'paid',
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
    const rows = (Array.isArray(orders) ? orders : []).map((order) => ({
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
      status: order.status || 'paid',
      points_earned: Number(order.pointsEarned || 0),
      points_awarded: Boolean(order.pointsAwarded),
      points_awarded_at: order.pointsAwardedAt || null,
    }));
    if (!rows.length) return;
    const { error } = await client.from('orders').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  },

  async updateOrderStatus(orderId, nextStatus) {
    const client = requireSupabase();
    const { data, error } = await client.rpc('update_order_status', {
      order_id: orderId,
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, onChange)
      .subscribe();

    return () => client.removeChannel(channel);
  },
};
