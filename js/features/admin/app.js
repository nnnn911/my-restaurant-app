import { toast } from '../../ui/toast.js';
import { ensureStaffUsers, getCurrentStaff, loginStaff, logoutStaff } from './auth.js';
import { formatPrice, getMenu, createOrderOnline, incrementMenuSoldCounts, hydrateOnlineData } from '../../data/store.js';
import { bindStaffChrome, renderStaffShell } from './layout.js';
import { icon } from '../../ui/icons.js';
import { openStaffConfirm } from '../../ui/confirm.js';
import { readJson, writeJson } from '../../core/storage.js';
import { escapeAttr } from '../../core/html.js';

const POS_CART_KEY = 'dq_pos_cart';
const POS_DRAFT_KEY = 'dq_pos_draft';

const MENU_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'ga', label: 'Gà' },
  { id: 'vit', label: 'Vịt' },
  { id: 'bun', label: 'Bún' },
  { id: 'mien', label: 'Miến' },
  { id: 'chao', label: 'Cháo' },
  { id: 'kho', label: 'Món khô' },
];

const POS_PAYMENT_METHODS = [
  { id: 'cash', name: 'Tiền mặt', icon: 'cash' },
  { id: 'bank', name: 'Chuyển khoản', icon: 'bank' },
  { id: 'momo', name: 'MoMo', icon: 'momo' },
  { id: 'vnpay', name: 'VNPay', icon: 'vnpay' },
];

const normalizePaymentMethod = (method) => method === 'transfer' ? 'bank' : method;

const getPosCart = () => {
  const cart = readJson(POS_CART_KEY, []);
  return Array.isArray(cart) ? cart : [];
};

const savePosCart = (cart) => {
  writeJson(POS_CART_KEY, Array.isArray(cart) ? cart : []);
};

const clearPosCart = () => savePosCart([]);

const calcSubtotal = (cart) =>
  (cart || []).reduce((sum, it) => sum + Number(it.price || 0) * Number(it.qty || 0), 0);

const normalizeDiscountType = (type) => type === 'percent' ? 'percent' : 'amount';

const getPosDiscount = (subtotal, draft = getPosDraft()) => {
  const type = normalizeDiscountType(draft.discountType);
  const rawValue = Number(draft.discountValue || 0);
  const value = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0;
  const safeSubtotal = Math.max(0, Number(subtotal || 0));
  const discount = type === 'percent'
    ? Math.round(safeSubtotal * Math.min(value, 100) / 100)
    : Math.round(value);
  return {
    type,
    value,
    amount: Math.min(Math.max(discount, 0), safeSubtotal),
  };
};

const getDiscountLabel = ({ type, value, amount }) => {
  if (!amount) return 'Chưa áp dụng';
  return type === 'percent' ? `${value}% (${formatPrice(amount)})` : formatPrice(amount);
};

const isPosMounted = () => {
  return Boolean(document.getElementById('pos-menu-grid'));
};

const updatePosFilterUI = () => {
  if (!isPosMounted()) return;
  const draft = getPosDraft();
  const active = (draft.category || 'all').toString();
  document.querySelectorAll('.menu-filter-btn[data-filter]')?.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === active);
  });
};

const updatePosCustomerSummaryUI = () => {
  if (!isPosMounted()) return;
  const d = getPosDraft();
  const name = (d.customerName || '').toString().trim();
  const phone = (d.phone || '').toString().trim();
  const summary = document.getElementById('pos-customer-summary');
  const btn = document.getElementById('pos-edit-customer');
  if (!summary || !btn) return;

  if (!name && !phone) {
    summary.textContent = '';
    btn.setAttribute('aria-label', 'Thêm thông tin khách');
    btn.innerHTML = '<img src="assets/icons/addpeople.svg" alt="" aria-hidden="true">';
    return;
  }
  summary.textContent = `${name || '—'}${phone ? ` • ${phone}` : ''}`;
  btn.setAttribute('aria-label', 'Sửa thông tin khách');
  btn.innerHTML = '<img src="assets/icons/pen.svg" alt="" aria-hidden="true">';
};

const createPosOrder = async ({ staff, cart, payment }) => {
  const snapshot = getPosDraft();
  const name = (snapshot.customerName || '').toString().trim() || 'Khách tại quán';
  const phone = (snapshot.phone || '').toString().trim();
  const subtotalNow = calcSubtotal(cart);
  const discount = getPosDiscount(subtotalNow, snapshot).amount;
  const total = Math.max(0, subtotalNow - discount);

  let order;
  try {
    order = await createOrderOnline({
    userId: `staff:${staff.id}`,
    customerName: name,
    customerPhone: phone,
    address: 'Tại quán',
    note: '',
    paymentMethod: payment,
    items: cart.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, note: i.note || '' })),
    subtotal: subtotalNow,
    discount,
    total,
    voucherCode: null,
    source: 'pos',
    status: 'completed',
    });
  } catch (error) {
    toast.error(error?.message || 'Không thể tạo đơn POS online.');
    return;
  }

  if (!order?._online) incrementMenuSoldCounts(cart.map((i) => ({ id: i.id, qty: i.qty })));
  window.dispatchEvent(new CustomEvent('menu:updated'));

  clearPosCart();
  setPosDraft({ ...snapshot, payment, note: '', discountType: 'amount', discountValue: 0 });
  toast.success(`Tạo đơn thành công: ${order.id}`);
  showPosSuccess(order);
  updatePosCartUI();
};

const showPosDiscountDrawer = () => {
  const subtotal = calcSubtotal(getPosCart());
  if (subtotal <= 0) return;

  document.getElementById('pos-discount-drawer')?.remove();
  const d = getPosDraft();
  const discount = getPosDiscount(subtotal, d);

  const drawer = document.createElement('div');
  drawer.className = 'pos-customer-drawer-backdrop';
  drawer.id = 'pos-discount-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Giảm giá');

  drawer.innerHTML = `
    <aside class="pos-customer-drawer-panel" role="document">
      <div class="pos-customer-drawer-body">
        <div class="pos-customer-drawer-title">Giảm giá</div>
        <div class="payment-methods pos-payment-methods" role="radiogroup" aria-label="Kiểu giảm giá">
          <label class="payment-method-card slim ${discount.type === 'amount' ? 'selected' : ''}" data-discount-type="amount">
            <input type="radio" name="pos-discount-type" value="amount" ${discount.type === 'amount' ? 'checked' : ''}>
            <div class="payment-method-left">
              ${icon('dollar', '', 'payment-method-icon')}
              <span class="payment-method-name">Số tiền</span>
            </div>
            <span class="payment-method-dot" aria-hidden="true"></span>
          </label>
          <label class="payment-method-card slim ${discount.type === 'percent' ? 'selected' : ''}" data-discount-type="percent">
            <input type="radio" name="pos-discount-type" value="percent" ${discount.type === 'percent' ? 'checked' : ''}>
            <div class="payment-method-left">
              ${icon('voucher', '', 'payment-method-icon')}
              <span class="payment-method-name">Phần trăm</span>
            </div>
            <span class="payment-method-dot" aria-hidden="true"></span>
          </label>
        </div>
        <div class="form-group" style="margin-top:var(--space-4)">
          <label class="form-label" for="pos-discount-value">Giá trị giảm</label>
          <input class="form-control" id="pos-discount-value" type="number" min="0" step="1" inputmode="numeric" value="${escapeAttr(String(discount.value || ''))}" placeholder="Nhập số tiền hoặc %">
        </div>
        <div class="staff-muted" id="pos-discount-preview" style="margin-top:var(--space-2)"></div>
        <div class="pos-customer-drawer-actions">
          <button class="btn btn-outline" type="button" id="pos-discount-clear">Xoá giảm giá</button>
          <button class="btn btn-outline" type="button" id="pos-discount-cancel">Thoát</button>
          <button class="btn btn-primary" type="button" id="pos-discount-save">Áp dụng</button>
        </div>
      </div>
    </aside>
  `;

  document.body.appendChild(drawer);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => drawer.classList.add('active'));

  const close = () => {
    drawer.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => drawer.remove(), 250);
  };

  const updatePreview = () => {
    const type = drawer.querySelector('input[name=pos-discount-type]:checked')?.value || 'amount';
    const value = Number(document.getElementById('pos-discount-value')?.value || 0);
    const nextDiscount = getPosDiscount(subtotal, { discountType: type, discountValue: value });
    const total = Math.max(0, subtotal - nextDiscount.amount);
    const preview = document.getElementById('pos-discount-preview');
    if (preview) {
      preview.textContent = `Giảm ${getDiscountLabel(nextDiscount)} · Tổng còn ${formatPrice(total)}`;
    }
  };

  drawer.addEventListener('click', (e) => {
    if (e.target === drawer) close();
  });

  drawer.querySelectorAll('.payment-method-card').forEach((card) => {
    card.addEventListener('click', () => {
      drawer.querySelectorAll('.payment-method-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      card.querySelector('input[type=radio]').checked = true;
      updatePreview();
    });
  });

  document.getElementById('pos-discount-value')?.addEventListener('input', updatePreview);
  document.getElementById('pos-discount-cancel')?.addEventListener('click', close);
  document.getElementById('pos-discount-clear')?.addEventListener('click', () => {
    setPosDraft({ ...getPosDraft(), discountType: 'amount', discountValue: 0 });
    close();
    updatePosCartUI();
  });
  document.getElementById('pos-discount-save')?.addEventListener('click', () => {
    const type = drawer.querySelector('input[name=pos-discount-type]:checked')?.value || 'amount';
    const value = Number(document.getElementById('pos-discount-value')?.value || 0);
    setPosDraft({ ...getPosDraft(), discountType: type, discountValue: value });
    close();
    updatePosCartUI();
  });

  updatePreview();
  setTimeout(() => document.getElementById('pos-discount-value')?.focus(), 0);
};

const showPosPaymentDrawer = ({ staff, cart }) => {
  document.getElementById('pos-payment-drawer')?.remove();
  const d = getPosDraft();
  const selectedPayment = POS_PAYMENT_METHODS.some((m) => m.id === d.payment) ? d.payment : 'cash';

  const drawer = document.createElement('div');
  drawer.className = 'pos-customer-drawer-backdrop';
  drawer.id = 'pos-payment-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Phương thức thanh toán');

  drawer.innerHTML = `
    <aside class="pos-customer-drawer-panel" role="document">
      <div class="pos-customer-drawer-body">
        <div class="pos-customer-drawer-title">Phương thức thanh toán</div>
        <div class="payment-methods pos-payment-methods" role="radiogroup" aria-label="Phương thức thanh toán">
          ${POS_PAYMENT_METHODS.map((m) => `
            <label class="payment-method-card slim ${m.id === selectedPayment ? 'selected' : ''}" data-method="${m.id}">
              <input type="radio" name="pos-payment-method" value="${m.id}" ${m.id === selectedPayment ? 'checked' : ''}>
              <div class="payment-method-left">
                ${icon(m.icon, '', 'payment-method-icon')}
                <span class="payment-method-name">${m.name}</span>
              </div>
              <span class="payment-method-dot" aria-hidden="true"></span>
            </label>
          `).join('')}
        </div>
        <div class="pos-customer-drawer-actions">
          <button class="btn btn-outline" type="button" id="pos-payment-cancel">Thoát</button>
          <button class="btn btn-primary" type="button" id="pos-payment-continue">Tiếp tục</button>
        </div>
      </div>
    </aside>
  `;

  document.body.appendChild(drawer);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => drawer.classList.add('active'));

  const close = () => {
    drawer.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => drawer.remove(), 250);
  };

  drawer.addEventListener('click', (e) => {
    if (e.target === drawer) close();
  });

  drawer.querySelectorAll('.payment-method-card').forEach((card) => {
    card.addEventListener('click', () => {
      drawer.querySelectorAll('.payment-method-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      card.querySelector('input[type=radio]').checked = true;
    });
  });

  document.getElementById('pos-payment-cancel')?.addEventListener('click', close);
  document.getElementById('pos-payment-continue')?.addEventListener('click', () => {
    const payment = drawer.querySelector('input[name=pos-payment-method]:checked')?.value || 'cash';
    setPosDraft({ ...getPosDraft(), payment });
    close();
    createPosOrder({ staff, cart, payment });
  });
};

const updatePosMenuUI = (query = null) => {
  if (!isPosMounted()) return;

  const menu = getMenu();
  const draft = getPosDraft();
  const activeCat = (draft.category || 'all').toString();
  const q = (query == null ? (draft.search || '') : query).toString().trim().toLowerCase();

  const filtered = (menu || []).filter((m) => {
    if (m?.status === 'hidden') return false;
    const matchCat = activeCat === 'all' || (m?.category || '') === activeCat;
    const hay = `${m?.name || ''} ${(m?.desc || '')}`.toLowerCase();
    const matchSearch = !q || hay.includes(q);
    return matchCat && matchSearch;
  });

  const grid = document.getElementById('pos-menu-grid');
  if (!grid) return;

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">${icon('menu', 'Thực đơn')}</div>
        <h3>Không tìm thấy món</h3>
        <p>Thử từ khoá khác.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((item) => `
    <article class="menu-item-card" role="listitem" data-id="${item.id}" tabindex="0" aria-label="${item.name}">
      <div class="menu-item-img-wrap">
        <img class="menu-item-img" src="${item.img}" alt="${item.name}" loading="lazy" onerror="this.src='assets/images/placeholder.svg'">
        ${item.status === 'soldout' ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;"><span class="badge badge-muted">Hết món</span></div>` : ''}
      </div>
      <div class="menu-item-body">
        <h3 class="menu-item-name">${item.name}</h3>
        <div class="menu-item-footer">
          <span class="price price-lg">${formatPrice(item.price)}</span>
          <button class="btn btn-primary btn-sm btn-add-cart" data-add="${item.id}" ${item.status !== 'available' ? 'disabled' : ''} aria-label="Thêm vào đơn">+</button>
        </div>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('[data-add]')?.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = (menu || []).find((m) => m.id === btn.dataset.add);
      if (!item) return;
      capturePosDraftFromDom();
      addToPosCart(item);
    });
  });
};

const updatePosCartUI = () => {
  if (!isPosMounted()) return;

  const menu = getMenu();
  const cart = getPosCart();
  const subtotal = calcSubtotal(cart);
  const discount = getPosDiscount(subtotal);
  const total = Math.max(0, subtotal - discount.amount);

  const body = document.getElementById('pos-cart-body');
  if (!body) return;

  if (!cart.length) {
    body.innerHTML = `
      <div class="empty-state" style="padding:var(--space-6) 0">
        <div class="empty-state-icon">${icon('order', 'Đơn hàng')}</div>
        <h3>Chưa có món</h3>
        <p>Chọn món từ menu.</p>
      </div>`;
  } else {
    body.innerHTML = `
      <div class="pos-cart-list">
        ${cart.map((it) => {
          const m = (menu || []).find((x) => x.id === it.id);
          const img = m?.img || 'assets/images/placeholder.svg';
          const total = Number(it.price || 0) * Number(it.qty || 0);
          return `
            <div class="pos-cart-item" data-id="${it.id}">
              <div class="pos-cart-thumb" aria-hidden="true">
                <img src="${img}" alt="" loading="lazy" onerror="this.src='assets/images/placeholder.svg'">
              </div>
              <div class="pos-cart-main">
                <div class="pos-cart-name">${it.name}</div>
                <div class="pos-cart-meta">
                  <div class="pos-cart-total">${formatPrice(total)}</div>
                  <div class="qty-stepper">
                    <button class="qty-btn" data-dec="${it.id}" aria-label="Giảm">−</button>
                    <span class="qty-value" style="min-width:24px;text-align:center">${it.qty}</span>
                    <button class="qty-btn" data-inc="${it.id}" aria-label="Tăng">+</button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    body.querySelectorAll('[data-dec]')?.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.dec;
        const item = cart.find((x) => x.id === id);
        if (!item) return;
        updateCartQty(id, item.qty - 1);
      });
    });
    body.querySelectorAll('[data-inc]')?.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.inc;
        const item = cart.find((x) => x.id === id);
        if (!item) return;
        updateCartQty(id, item.qty + 1);
      });
    });
  }

  const el = document.getElementById('pos-price-summary');
  if (el) {
    el.innerHTML = `
      <div class="staff-kv">
        <div class="staff-muted">Tạm tính</div>
        <div style="font-weight:600">${formatPrice(subtotal)}</div>
      </div>
      <div class="staff-kv" style="margin-top:8px">
        <div class="staff-muted">Giảm giá</div>
        <div style="font-weight:600">-${formatPrice(discount.amount)}</div>
      </div>
      <div class="staff-kv" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--color-border)">
        <div style="font-weight:600">Tổng cộng</div>
        <div class="price" style="font-weight:700">${formatPrice(total)}</div>
      </div>
      <button class="btn btn-outline btn-block" id="pos-discount-open" type="button" style="margin-top:var(--space-3)" ${cart.length ? '' : 'disabled'}>
        ${icon('dollar')} Giảm giá${discount.amount ? `: ${getDiscountLabel(discount)}` : ''}
      </button>
    `;

    document.getElementById('pos-discount-open')?.addEventListener('click', showPosDiscountDrawer);
  }

  const createBtn = document.getElementById('pos-create');
  if (createBtn) createBtn.toggleAttribute('disabled', !cart.length);
};

const addToPosCart = (menuItem) => {
  const cart = getPosCart();
  const existing = cart.find((c) => c.id === menuItem.id);
  if (existing) existing.qty += 1;
  else cart.push({ id: menuItem.id, name: menuItem.name, price: menuItem.price, qty: 1, note: '' });
  savePosCart(cart);
  updatePosCartUI();
};

const updateCartQty = (id, nextQty) => {
  const cart = getPosCart();
  const item = cart.find((c) => c.id === id);
  if (!item) return;
  const qty = Number(nextQty);
  if (!Number.isFinite(qty) || qty <= 0) {
    savePosCart(cart.filter((c) => c.id !== id));
  } else {
    item.qty = qty;
    savePosCart(cart);
  }
  updatePosCartUI();
};

const getPosDraft = () => {
  const d = readJson(POS_DRAFT_KEY, null);
  return d && typeof d === 'object'
    ? {
        customerName: (d.customerName || '').toString(),
        phone: (d.phone || '').toString(),
        payment: normalizePaymentMethod((d.payment || 'cash').toString()),
        note: (d.note || '').toString(),
        search: (d.search || '').toString(),
        category: (d.category || 'all').toString(),
        discountType: normalizeDiscountType(d.discountType),
        discountValue: Number(d.discountValue || 0),
      }
    : { customerName: '', phone: '', payment: 'cash', note: '', search: '', category: 'all', discountType: 'amount', discountValue: 0 };
};

const setPosDraft = (next) => {
  const safe = next && typeof next === 'object' ? next : {};
  const allowedCats = new Set(MENU_FILTERS.map((f) => f.id));
  const rawCat = (safe.category || 'all').toString();
  const category = allowedCats.has(rawCat) ? rawCat : 'all';
  writeJson(POS_DRAFT_KEY, {
    customerName: (safe.customerName || '').toString(),
    phone: (safe.phone || '').toString(),
    payment: normalizePaymentMethod((safe.payment || 'cash').toString()),
    note: (safe.note || '').toString(),
    search: (safe.search || '').toString(),
    category,
    discountType: normalizeDiscountType(safe.discountType),
    discountValue: Number(safe.discountValue || 0),
    updatedAt: new Date().toISOString(),
  });
};

const capturePosDraftFromDom = () => {
  const prev = getPosDraft();
  const next = {
    ...prev,
    customerName: (document.getElementById('pos-customer')?.value || prev.customerName).toString(),
    phone: (document.getElementById('pos-phone')?.value || prev.phone).toString(),
    payment: (document.getElementById('pos-payment')?.value || prev.payment).toString(),
    note: (document.getElementById('pos-note')?.value || prev.note).toString(),
    search: (document.getElementById('pos-search')?.value || prev.search).toString(),
  };
  setPosDraft(next);
  return next;
};

const renderLogin = () => {
  ensureStaffUsers();
  const root = document.getElementById('page-content');
  root.classList.add('page-content--staff');
  root.innerHTML = `
    <section style="padding:var(--space-16) 0;background:var(--color-bg)">
      <div class="container">
        <div style="text-align:center;margin-bottom:var(--space-10)">
          <h1 class="section-title" style="font-size:var(--font-size-3xl)">${icon('password')} Đăng nhập nhân viên</h1>
          <p class="section-subtitle" style="margin-top:var(--space-5)">Trang khởi đầu cho nhân viên (POS).</p>
        </div>

        <div class="card" style="max-width:520px;margin:0 auto">
          <div class="card-body" style="padding:var(--space-8)">
            <form id="staff-login-form" novalidate>
              <div class="form-group">
                <label class="form-label" for="staff-phone">Số điện thoại</label>
                <div class="input-group">
                  <span class="input-icon" aria-hidden="true">${icon('phone')}</span>
                  <input class="form-control" id="staff-phone" type="tel" autocomplete="tel" placeholder="Nhập số điện thoại" required>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="staff-password">Mật khẩu</label>
                <div class="input-group">
                  <span class="input-icon" aria-hidden="true">${icon('password')}</span>
                  <input class="form-control" id="staff-password" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu" required>
                  <span class="input-icon-right" id="toggle-staff-pw" role="button" aria-label="Hiện mật khẩu" title="Hiện mật khẩu">${icon('showpassword')}</span>
                </div>
              </div>
              <div id="staff-login-error" class="form-error" style="display:none;margin-bottom:var(--space-4)"></div>
              <button type="submit" class="btn btn-primary btn-block btn-lg">Đăng nhập</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  `;

  const form = document.getElementById('staff-login-form');
  document.getElementById('toggle-staff-pw')?.addEventListener('click', () => {
    const toggle = document.getElementById('toggle-staff-pw');
    const input = document.getElementById('staff-password');
    const nextType = input.type === 'password' ? 'text' : 'password';
    input.type = nextType;
    const isVisible = nextType === 'text';
    toggle.innerHTML = icon(isVisible ? 'hidepassword' : 'showpassword');
    toggle.setAttribute('aria-label', isVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    toggle.setAttribute('title', isVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('staff-login-error');
    errEl.style.display = 'none';

    const phone = document.getElementById('staff-phone').value.trim();
    const password = document.getElementById('staff-password').value;
    if (!phone || !password) {
      errEl.textContent = 'Vui lòng nhập đầy đủ thông tin.';
      errEl.style.display = 'flex';
      return;
    }

    const result = await loginStaff(phone, password);
    if (!result.ok) {
      errEl.innerHTML = `${icon('warning')} ${result.msg}`;
      errEl.style.display = 'flex';
      return;
    }

    toast.success('Đăng nhập thành công.');
    renderPos();
  });
};

const renderPos = () => {
  const staff = getCurrentStaff();
  if (!staff) {
    renderLogin();
    return;
  }

  const root = document.getElementById('page-content');
  root.classList.add('page-content--staff');

  if (!isPosMounted()) {
    const draft = getPosDraft();
    root.innerHTML = renderStaffShell({
      active: 'pos',
      pageTitle: '',
      pageSubtitle: '',
      contentHtml: `
        <div class="staff-grid staff-grid--pos">
          <section class="staff-panel" aria-label="Chọn món">
            <div class="staff-panel-header">
              <div style="display:flex;align-items:center;gap:var(--space-3);flex:1;min-width:0">
                <div class="search-bar" style="max-width:none;flex:1">
                  <span class="search-icon" aria-hidden="true">${icon('search')}</span>
                  <input type="search" id="pos-search" placeholder="Tìm món ăn..." aria-label="Tìm món ăn" value="${(draft.search || '').replaceAll('"', '&quot;')}">
                </div>
              </div>
              <div class="menu-filters" role="tablist" aria-label="Lọc loại món ăn">
                ${MENU_FILTERS.map((f) => `
                  <button class="menu-filter-btn${f.id === (draft.category || 'all') ? ' active' : ''}" data-filter="${f.id}" type="button">${f.label}</button>
                `).join('')}
              </div>
            </div>
            <div class="staff-panel-body menu-grid" id="pos-menu-grid" style="padding:var(--space-4)" role="list" aria-label="Danh sách món"></div>
          </section>

          <aside class="staff-panel" aria-label="Thông tin đơn hàng">
            <div class="staff-panel-header">
              <div style="min-width:0;flex:1">
                <div class="staff-panel-title">Chi tiết đơn hàng</div>
                <div class="staff-muted" id="pos-customer-summary"></div>
              </div>
              <div class="admin-order-header-actions">
                <button class="btn btn-outline btn-icon-sm pos-round-action pos-customer-action" id="pos-edit-customer" type="button" aria-label="Thêm thông tin khách">
                  <img src="assets/icons/addpeople.svg" alt="" aria-hidden="true">
                </button>
                <button class="btn btn-danger btn-icon-sm pos-round-action pos-clear-action" id="pos-clear-order" type="button" aria-label="Làm lại đơn hàng">
                  <img src="assets/icons/trashcan.svg" alt="" aria-hidden="true">
                </button>
              </div>
            </div>
            <div class="staff-panel-body" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
              <div style="flex:1;min-height:0;overflow:auto;padding:var(--space-4)">
                <div id="pos-cart-body"></div>
              </div>

              <div style="border-top:1px solid var(--color-border);padding:var(--space-4)">
                <div id="pos-price-summary"></div>
                <div id="pos-error" class="form-error" style="display:none;margin-top:var(--space-4)"></div>
                <div style="margin-top:var(--space-4)">
                  <button class="btn btn-primary btn-block" id="pos-create" disabled>Tiếp tục</button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      `,
    });

    const doLogout = () => {
      logoutStaff();
      toast.success('Đã đăng xuất.');
      renderLogin();
    };
    bindStaffChrome({ onLogout: doLogout });

    const showCustomerDrawer = () => {
    document.getElementById('pos-customer-drawer')?.remove();
    const d = getPosDraft();

    const drawer = document.createElement('div');
    drawer.className = 'pos-customer-drawer-backdrop';
    drawer.id = 'pos-customer-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', 'Thông tin khách');

    drawer.innerHTML = `
      <aside class="pos-customer-drawer-panel" role="document">
        <div class="pos-customer-drawer-body">
          <div class="pos-customer-drawer-title">Thông tin khách</div>
          <div class="form-group">
            <label class="form-label" for="pos-customer-name">Tên khách (tuỳ chọn)</label>
            <input class="form-control" id="pos-customer-name" type="text" placeholder="Khách tại quán" value="${escapeAttr(d.customerName)}">
          </div>
          <div class="form-group">
            <label class="form-label" for="pos-customer-phone">SĐT (tuỳ chọn)</label>
            <input class="form-control" id="pos-customer-phone" type="tel" placeholder="0901234567" value="${escapeAttr(d.phone)}">
          </div>
          <div class="pos-customer-drawer-actions">
            <button class="btn btn-outline" type="button" id="pos-customer-cancel">Thoát</button>
            <button class="btn btn-primary" type="button" id="pos-customer-save">Lưu</button>
          </div>
        </div>
      </aside>
    `;

    document.body.appendChild(drawer);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => drawer.classList.add('active'));

    const close = () => {
      drawer.classList.remove('active');
      document.body.style.overflow = '';
      setTimeout(() => drawer.remove(), 250);
    };

    drawer.addEventListener('click', (e) => {
      if (e.target === drawer) close();
    });

    document.getElementById('pos-customer-cancel')?.addEventListener('click', close);

    document.getElementById('pos-customer-save')?.addEventListener('click', () => {
      const name = (document.getElementById('pos-customer-name')?.value || '').toString();
      const phone = (document.getElementById('pos-customer-phone')?.value || '').toString();
      setPosDraft({ ...getPosDraft(), customerName: name, phone });
      updatePosCustomerSummaryUI();
      close();
    });

    setTimeout(() => document.getElementById('pos-customer-name')?.focus(), 0);
  };

    document.getElementById('pos-edit-customer')?.addEventListener('click', () => {
      showCustomerDrawer();
    });

  document.getElementById('pos-clear-order')?.addEventListener('click', async () => {
    const ok = await openStaffConfirm({
      title: 'Làm lại đơn hàng',
      message: 'Xác nhận xoá toàn bộ món trong đơn hiện tại và làm lại thông tin khách?',
      confirmText: 'Xoá đơn',
      danger: true,
    });
    if (!ok) return;
    const currentDraft = getPosDraft();
    clearPosCart();
    setPosDraft({ ...currentDraft, customerName: '', phone: '', payment: 'cash', note: '', discountType: 'amount', discountValue: 0 });
    updatePosCustomerSummaryUI();
    updatePosCartUI();
    updatePosFilterUI();
    updatePosMenuUI();
  });

  document.getElementById('pos-search')?.addEventListener('input', (e) => {
    setPosDraft({ ...getPosDraft(), search: e.target.value });
    updatePosMenuUI(e.target.value);
  });

  document.querySelectorAll('.menu-filter-btn[data-filter]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextCat = btn.dataset.filter;
      setPosDraft({ ...getPosDraft(), category: nextCat });
      updatePosFilterUI();
      updatePosMenuUI();
    });
  });

  document.getElementById('pos-create')?.addEventListener('click', () => {
    const errEl = document.getElementById('pos-error');
    errEl.style.display = 'none';

    const freshCart = getPosCart();
    if (!freshCart.length) {
      errEl.innerHTML = `${icon('warning')} Giỏ POS đang trống.`;
      errEl.style.display = 'flex';
      return;
    }

    showPosPaymentDrawer({ staff, cart: freshCart });
  });
  }

  updatePosFilterUI();
  updatePosMenuUI();
  updatePosCustomerSummaryUI();
  updatePosCartUI();
};

const showPosSuccess = (order) => {
  document.getElementById('pos-success-modal')?.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';
  modal.id = 'pos-success-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-body">
        <div class="order-success">
          <h2>Tạo đơn tại quán thành công!</h2>
          <div class="order-number">Mã đơn: ${order.id}</div>
          <p>Đơn đã được lưu vào hệ thống để theo dõi trạng thái.</p>
          <div style="display:flex;gap:var(--space-3);margin-top:var(--space-6);justify-content:center;flex-wrap:wrap">
            <a class="btn btn-outline" href="admin-pos-orders.html">Xem đơn tại quán</a>
            <button class="btn btn-primary" id="pos-success-close">Tiếp tục</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  const close = () => {
    modal.remove();
    document.body.style.overflow = '';
  };

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.getElementById('pos-success-close')?.addEventListener('click', close);
};

document.addEventListener('DOMContentLoaded', async () => {
  ensureStaffUsers();
  renderPos();
  hydrateOnlineData().then(() => renderPos()).catch(() => {});
});
