/**
 * checkout.js - Checkout page module
 */
import {
  getCart, getCartTotal, createOrder, clearCart,
  getCurrentUser, calculateOrderPoints, formatPrice, incrementMenuSoldCounts,
  getCurrentUserVouchers,
  validateVoucher, getCheckoutDraft, clearCheckoutDraft, setCheckoutDraft,
  createOrderOnline
} from '../../data/store.js';
import { toast } from '../../ui/toast.js';
import { updateCartBadge } from '../../ui/navbar.js';
import { icon } from '../../ui/icons.js';
import { showRedeemVoucherModal } from './rewards.js';
import { escapeAttr, escapeHtml } from '../../core/html.js';

const DEFAULT_CITY = 'TP. HCM';
const HCMC_WARDS = [
  'Phường Bến Thành',
  'Phường Tân Định',
  'Phường Sài Gòn',
  'Phường Cầu Ông Lãnh',
  'Phường Bàn Cờ',
  'Phường Xuân Hòa',
  'Phường Nhiêu Lộc',
  'Phường Vĩnh Hội',
  'Phường Khánh Hội',
  'Phường Xóm Chiếu',
  'Phường Gia Định',
  'Phường Bình Thạnh',
  'Phường Bình Lợi Trung',
  'Phường Thạnh Mỹ Tây',
  'Phường Bình Quới',
  'Phường Hiệp Bình',
  'Phường Tam Bình',
  'Phường Thủ Đức',
  'Phường Linh Xuân',
  'Phường Long Bình',
  'Phường Tăng Nhơn Phú',
  'Phường Phước Long',
  'Phường Long Phước',
  'Phường Long Trường',
  'Phường An Khánh',
  'Phường Bình Trưng',
  'Phường Cát Lái',
];

const normalizePaymentMethod = (method) => method === 'transfer' ? 'bank' : method;

const mergeCheckoutDraft = (patch) => {
  const current = getCheckoutDraft() || {};
  return setCheckoutDraft({ ...current, ...patch });
};

const readCheckoutFormDraft = () => ({
  name: document.getElementById('co-name')?.value || '',
  phone: document.getElementById('co-phone')?.value || '',
  city: document.getElementById('co-city')?.value || DEFAULT_CITY,
  ward: document.getElementById('co-ward')?.value || '',
  addressDetail: document.getElementById('co-address-detail')?.value || '',
  note: document.getElementById('co-note')?.value || '',
  paymentMethod: normalizePaymentMethod(document.querySelector('#checkout-page input[name=payment]:checked')?.value || 'cash'),
});

const persistCheckoutFormDraft = () => {
  mergeCheckoutDraft(readCheckoutFormDraft());
};

const mountCheckoutSection = (section) => {
  const page = document.querySelector('.page-content');
  if (!page) return;
  const footer = page.querySelector('.footer');
  page.insertBefore(section, footer || null);
};

const getAppliedVoucherFromDraft = (subtotal) => {
  const draft = getCheckoutDraft();
  const code = (draft?.voucherCode || '').toString().trim();
  if (!code) return null;
  const result = validateVoucher(code, subtotal);
  return result.ok ? result : null;
};

const voucherValueLabel = (voucher = {}) =>
  voucher.type === 'percent' ? `${Number(voucher.value || 0)}%` : formatPrice(Number(voucher.value || 0));

const clearCheckoutVoucher = () => {
  const { voucherCode, ...rest } = getCheckoutDraft() || {};
  setCheckoutDraft(rest);
};

const showCheckoutVoucherModal = ({ subtotal = 0 } = {}) => {
  document.getElementById('checkout-voucher-modal')?.remove();
  const vouchers = getCurrentUserVouchers().filter((voucher) => voucher.active);
  const appliedCode = (getCheckoutDraft()?.voucherCode || '').toString().toUpperCase();
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';
  modal.id = 'checkout-voucher-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Áp dụng voucher');
  modal.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <span class="modal-title">${icon('voucher')} Áp dụng voucher</span>
        <button class="modal-close" id="checkout-voucher-close" aria-label="Đóng">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <div class="checkout-voucher-modal-list">
          ${vouchers.length ? vouchers.map((voucher) => {
            const result = validateVoucher(voucher.code, subtotal);
            return `
              <button class="checkout-voucher-option${voucher.code === appliedCode ? ' selected' : ''}" type="button" data-voucher-select="${escapeAttr(voucher.code)}" ${!result.ok ? 'disabled' : ''}>
                <span>
                  <strong>${escapeHtml(voucher.code)}</strong>
                  <small>${escapeHtml(voucher.desc || 'Voucher của bạn')}</small>
                  ${!result.ok ? `<em>${escapeHtml(result.msg)}</em>` : ''}
                </span>
                <b>${voucherValueLabel(voucher)}</b>
              </button>
            `;
          }).join('') : `<div class="empty-state compact"><h3>Bạn chưa có voucher đã đổi</h3></div>`}
        </div>
        <div class="form-group" style="margin-top:var(--space-4)">
          <label class="form-label" for="checkout-manual-voucher">Nhập mã voucher thủ công</label>
          <div class="checkout-voucher-row">
            <input class="form-control" type="text" id="checkout-manual-voucher" placeholder="Nhập mã voucher..." value="">
            <button class="btn btn-outline btn-sm" id="checkout-manual-apply" type="button">Áp dụng</button>
          </div>
        </div>
        <div class="staff-actions" style="justify-content:space-between;margin-top:var(--space-4)">
          <button class="btn btn-primary" id="checkout-open-redeem" type="button">${icon('voucher')} Đổi voucher</button>
          ${appliedCode ? `<button class="btn btn-outline" id="checkout-clear-voucher" type="button">Bỏ voucher</button>` : ''}
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
  const applyCode = (code) => {
    const result = validateVoucher(code, subtotal);
    if (!result.ok) {
      toast.error(result.msg);
      return;
    }
    persistCheckoutFormDraft();
    mergeCheckoutDraft({ voucherCode: result.voucher.code });
    toast.success(`Áp dụng voucher thành công! Giảm ${formatPrice(result.discount)}`);
    close();
    rerenderCheckoutPreservingScroll();
  };

  modal.querySelector('#checkout-voucher-close')?.addEventListener('click', close);
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
  modal.querySelectorAll('[data-voucher-select]')?.forEach((button) => {
    button.addEventListener('click', () => applyCode(button.dataset.voucherSelect));
  });
  modal.querySelector('#checkout-manual-apply')?.addEventListener('click', () => {
    const code = (modal.querySelector('#checkout-manual-voucher')?.value || '').toString().trim();
    if (!code) {
      toast.info('Vui lòng nhập mã voucher.');
      return;
    }
    applyCode(code);
  });
  modal.querySelector('#checkout-manual-voucher')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    modal.querySelector('#checkout-manual-apply')?.click();
  });
  modal.querySelector('#checkout-clear-voucher')?.addEventListener('click', () => {
    persistCheckoutFormDraft();
    clearCheckoutVoucher();
    close();
    rerenderCheckoutPreservingScroll();
  });
  modal.querySelector('#checkout-open-redeem')?.addEventListener('click', () => {
    close();
    showRedeemVoucherModal({
      closeOnRedeemed: true,
      onRedeemed: (voucher) => {
        mergeCheckoutDraft({ voucherCode: voucher.code });
        toast.success(`Đã tạo và áp dụng voucher ${voucher.code}.`);
        rerenderCheckoutPreservingScroll();
      },
    });
  });
};

const rerenderCheckoutPreservingScroll = () => {
  const windowY = window.scrollY;
  const formPanelScroll = document.querySelector('.checkout-form-panel')?.scrollTop || 0;
  const itemsListScroll = document.querySelector('.checkout-items-list')?.scrollTop || 0;

  renderCheckoutPage();

  requestAnimationFrame(() => {
    window.scrollTo({ top: windowY, left: 0, behavior: 'auto' });
    const formPanel = document.querySelector('.checkout-form-panel');
    const itemsList = document.querySelector('.checkout-items-list');
    if (formPanel) formPanel.scrollTop = formPanelScroll;
    if (itemsList) itemsList.scrollTop = itemsListScroll;
  });
};

export const renderCheckoutPage = () => {
  document.getElementById('checkout-page')?.remove();

  const user = getCurrentUser();
  const cart = getCart();
  const subtotal = getCartTotal();
  const appliedVoucher = getAppliedVoucherFromDraft(subtotal);
  const discount = appliedVoucher ? appliedVoucher.discount : 0;
  const total = Math.max(0, subtotal - discount);
  const draft = getCheckoutDraft() || {};
  const customerName = draft.name ?? user?.name ?? '';
  const customerPhone = draft.phone ?? user?.phone ?? '';
  const customerCity = draft.city || DEFAULT_CITY;
  const customerWard = draft.ward || '';
  const customerAddressDetail = draft.addressDetail ?? '';
  const customerNote = draft.note ?? '';
  const paymentMethod = normalizePaymentMethod(draft.paymentMethod || 'cash');

  const section = document.createElement('section');
  section.id = 'checkout-page';
  section.className = 'checkout-section';
  section.setAttribute('aria-label', 'Thanh toán');

  if (!cart.length) {
    section.innerHTML = `
      <div class="container">
        <div class="empty-state" style="max-width:720px;margin:0 auto">
          <div class="empty-state-icon">${icon('cart', 'Giỏ hàng')}</div>
          <h3>Giỏ hàng trống</h3>
          <p>Quay lại thực đơn để chọn món nhé.</p>
          <div style="margin-top:var(--space-5)">
            <a class="btn btn-primary" href="index.html#menu">Xem thực đơn</a>
          </div>
        </div>
      </div>`;

    mountCheckoutSection(section);
    clearCheckoutDraft();
    return;
  }

  section.innerHTML = `
    <div class="container">
      <div class="checkout-layout checkout-content">
        <div class="checkout-summary">
          <div class="checkout-card">
            <div class="checkout-section-title" style="margin-bottom:var(--space-4)">
              <span class="checkout-section-num">1</span> Chi tiết đơn hàng
            </div>

            <div class="order-summary-body" style="padding:0">
              <div class="checkout-items-list">
                ${cart.map(item => `
                  <div class="order-summary-item">
                    <div>
                      <div class="order-summary-item-name">${escapeAttr(item.name)}</div>
                      <div class="order-summary-item-qty">x${Number(item.qty || 0)}</div>
                      ${item.note ? `<div class="order-summary-item-note">Ghi chú: ${escapeAttr(item.note)}</div>` : ''}
                    </div>
                    <strong>${formatPrice(item.price * item.qty)}</strong>
                  </div>`).join('')}
              </div>

              <div class="checkout-voucher in-summary">
                <button class="btn btn-outline btn-block checkout-voucher-trigger" type="button" id="btn-open-voucher-modal">
                  ${icon('voucher')} ${appliedVoucher ? `Đã áp dụng: ${escapeHtml(appliedVoucher.voucher.code)}` : 'Áp dụng voucher'}
                </button>
              </div>

              <div class="checkout-total-stack">
                <div class="order-summary-total-row"><span>Tạm tính</span><span>${formatPrice(subtotal)}</span></div>
                <div class="order-summary-total-row"><span>Giao hàng</span><span class="text-success">Miễn phí</span></div>
                ${appliedVoucher ? `<div class="order-summary-total-row text-success"><span>Voucher (${appliedVoucher.voucher.code})</span><span>-${formatPrice(discount)}</span></div>` : ''}
                <div class="order-summary-total-row grand"><span>Tổng cộng</span><span class="price">${formatPrice(total)}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="checkout-form-panel">
          <div class="checkout-details">
            <div class="checkout-card checkout-card--divider">
              <div class="checkout-section-title">
                <span class="checkout-section-num">2</span> Thông tin giao hàng
              </div>

              ${!user ? `
                <div class="form-error" style="margin-bottom:var(--space-4)">${icon('warning')} Vui lòng đăng nhập để đặt hàng.</div>
              ` : ''}

              <div class="reservation-grid">
                <div class="form-group">
                  <label class="form-label" for="co-name">Họ và tên *</label>
                  <input class="form-control" type="text" id="co-name" value="${escapeAttr(customerName)}" placeholder="Nguyễn Văn A" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="co-phone">Số điện thoại *</label>
                  <input class="form-control" type="tel" id="co-phone" value="${escapeAttr(customerPhone)}" placeholder="0901234567" required>
                </div>
              </div>
              <div class="checkout-address-row">
                <div class="form-group">
                  <label class="form-label" for="co-city">Thành phố</label>
                  <input class="form-control" type="text" id="co-city" value="${escapeAttr(customerCity)}" readonly>
                </div>
                <div class="form-group">
                  <label class="form-label" for="co-ward">Phường *</label>
                  <select class="form-control" id="co-ward" required>
                    <option value="">Chọn phường</option>
                    ${HCMC_WARDS.map((ward) => `<option value="${escapeAttr(ward)}" ${ward === customerWard ? 'selected' : ''}>${ward}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group checkout-address-detail">
                  <label class="form-label" for="co-address-detail">Địa chỉ chi tiết *</label>
                  <input class="form-control" type="text" id="co-address-detail" value="${escapeAttr(customerAddressDetail)}" placeholder="Số nhà, tên đường">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="co-note">Ghi chú đơn hàng</label>
                <input class="form-control" type="text" id="co-note" value="${escapeAttr(customerNote)}" placeholder="Ghi chú thêm cho đơn hàng...">
              </div>
            </div>
          </div>

          <div class="checkout-payment">
            <div class="checkout-card checkout-card--divider">
              <div class="checkout-section-title">
                <span class="checkout-section-num">3</span> Phương thức thanh toán
              </div>

              <div class="payment-methods" role="radiogroup" aria-label="Phương thức thanh toán">
                ${[
                  { id: 'cash', icon: 'cash', name: 'Tiền mặt' },
                  { id: 'bank', icon: 'bank', name: 'Chuyển khoản' },
                  { id: 'momo', icon: 'momo', name: 'MoMo' },
                  { id: 'vnpay', icon: 'vnpay', name: 'VNPay' },
                ].map((m) => `
                  <label class="payment-method-card slim ${m.id === paymentMethod ? 'selected' : ''}" data-method="${m.id}">
                    <input type="radio" name="payment" value="${m.id}" ${m.id === paymentMethod ? 'checked' : ''}>
                    <div class="payment-method-left">
                      ${icon(m.icon, '', 'payment-method-icon')}
                      <span class="payment-method-name">${m.name}</span>
                    </div>
                    <span class="payment-method-dot" aria-hidden="true"></span>
                  </label>`).join('')}
              </div>
            </div>
          </div>

          <div id="checkout-error" class="form-error" style="display:none"></div>

          <div class="checkout-paybar" id="checkout-paybar">
            <div class="checkout-paybar-container">
              <div class="checkout-paybar-inner">
                <button class="btn btn-primary btn-lg" id="btn-place-order" ${!user ? 'disabled' : ''}>
                  Thanh toán
                </button>
                <div class="checkout-paybar-amount">
                  <div class="checkout-paybar-label">Tổng thanh toán</div>
                  <div class="checkout-paybar-total">${formatPrice(total)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="checkout-paybar checkout-paybar--docked" id="checkout-paybar-docked" aria-hidden="true">
          <div class="checkout-paybar-container">
            <div class="checkout-paybar-inner">
              <div class="checkout-paybar-amount">
                <div class="checkout-paybar-label">Tổng thanh toán</div>
                <div class="checkout-paybar-total">${formatPrice(total)}</div>
              </div>
              <button class="btn btn-primary btn-lg" id="btn-place-order-docked" ${!user ? 'disabled' : ''}>
                Thanh toán
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  mountCheckoutSection(section);

  // Payment method selection
  section.querySelectorAll('.payment-method-card').forEach(card => {
    card.addEventListener('click', () => {
      section.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      card.querySelector('input[type=radio]').checked = true;
      persistCheckoutFormDraft();
    });
  });

  section.querySelectorAll('#co-name, #co-phone, #co-city, #co-ward, #co-address-detail, #co-note').forEach((input) => {
    input.addEventListener('change', persistCheckoutFormDraft);
  });

  section.querySelector('#btn-open-voucher-modal')?.addEventListener('click', (event) => {
    event.preventDefault();
    persistCheckoutFormDraft();
    showCheckoutVoucherModal({ subtotal: getCartTotal() });
  });

  const placeOrder = async () => {
    const freshUser = getCurrentUser();
    if (!freshUser) {
      toast.info('Vui lòng đăng nhập để đặt hàng.');
      return;
    }

    const name = document.getElementById('co-name').value.trim();
    const phone = document.getElementById('co-phone').value.trim();
    const city = document.getElementById('co-city').value.trim() || DEFAULT_CITY;
    const ward = document.getElementById('co-ward').value.trim();
    const addressDetail = document.getElementById('co-address-detail').value.trim();
    const address = [addressDetail, ward, city].filter(Boolean).join(', ');
    const note = document.getElementById('co-note').value.trim();
    const payment = section.querySelector('input[name=payment]:checked')?.value || 'cash';
    const errEl = document.getElementById('checkout-error');

    if (!name || !phone || !ward || !addressDetail) {
      errEl.innerHTML = `${icon('warning')} Vui lòng nhập đầy đủ họ tên, số điện thoại và địa chỉ giao hàng.`;
      errEl.style.display = 'flex';
      return;
    }
    errEl.style.display = 'none';

    const currentCart = getCart();
    const currentSubtotal = getCartTotal();
    const currentVoucher = getAppliedVoucherFromDraft(currentSubtotal);
    const currentDiscount = currentVoucher ? currentVoucher.discount : 0;
    const currentTotal = Math.max(0, currentSubtotal - currentDiscount);

    let order;
    try {
      order = await createOrderOnline({
      userId: freshUser?.id || 'guest',
      customerName: name,
      customerPhone: phone,
      address,
      note,
      paymentMethod: payment,
      items: currentCart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, note: (i.note || '').toString().trim() })),
      subtotal: currentSubtotal,
      discount: currentDiscount,
      total: currentTotal,
      voucherCode: currentVoucher?.voucher?.code || null,
      });
    } catch (error) {
      errEl.innerHTML = `${icon('warning')} ${error?.message || 'Không thể tạo đơn hàng online. Vui lòng thử lại.'}`;
      errEl.style.display = 'flex';
      return;
    }

    // Update menu sold counts after successful order creation
    if (!order?._online) {
      incrementMenuSoldCounts(currentCart.map(i => ({ id: i.id, qty: i.qty })));
    }
    window.dispatchEvent(new CustomEvent('menu:updated'));

    const pts = calculateOrderPoints(currentTotal);

    clearCart();
    clearCheckoutDraft();
    updateCartBadge();

    // Refresh page to show empty state behind success modal
    renderCheckoutPage();
    showOrderSuccess(order, pts);
  };

  section.querySelector('#btn-place-order')?.addEventListener('click', placeOrder);
  section.querySelector('#btn-place-order-docked')?.addEventListener('click', placeOrder);

  // Docked pay bar: show fixed bar until user scrolls to the real paybar.
  const paybar = section.querySelector('#checkout-paybar');
  const dockedPaybar = section.querySelector('#checkout-paybar-docked');
  if (paybar && dockedPaybar && 'IntersectionObserver' in window) {
    const updateDocked = (isRealPaybarVisible) => {
      dockedPaybar.style.display = isRealPaybarVisible ? 'none' : 'block';
      dockedPaybar.setAttribute('aria-hidden', isRealPaybarVisible ? 'true' : 'false');
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        updateDocked(Boolean(entry?.isIntersecting));
      },
      { root: null, threshold: 0.01 }
    );
    observer.observe(paybar);

    // Initial state
    const rect = paybar.getBoundingClientRect();
    const initiallyVisible = rect.top < window.innerHeight && rect.bottom > 0;
    updateDocked(initiallyVisible);
  }
};

export const showCheckout = (appliedVoucher = null) => {
  // Legacy API: now routes to checkout page
  const code = appliedVoucher?.voucher?.code || null;
  if (code) setCheckoutDraft({ voucherCode: code });
  window.location.href = 'checkout.html';
};

const showOrderSuccess = (order, pointsEarned) => {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';
  modal.id = 'order-success-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-body">
        <div class="order-success">
          <h2>Đặt hàng thành công!</h2>
          <div class="order-number">Mã đơn: ${order.id}</div>
          <p>Cảm ơn bạn đã tin tưởng Quán Ăn Đồng Quê!<br>Đơn hàng đã thanh toán thành công và đang chờ nhân viên xác nhận.</p>
          ${pointsEarned ? `<div style="margin-top:var(--space-4);padding:var(--space-3) var(--space-5);background:var(--color-accent-100);border:1px solid var(--color-accent-300);border-radius:var(--radius-lg);font-size:var(--font-size-sm);color:var(--color-beige-800);font-weight:600">${icon('star')} Bạn sẽ nhận <strong>${pointsEarned} điểm</strong> sau khi hoàn thành đơn hàng.</div>` : ''}
          <div style="display:flex;gap:var(--space-3);margin-top:var(--space-6);justify-content:center;flex-wrap:wrap">
            <button class="btn btn-outline" id="view-order-detail">Xem chi tiết đơn</button>
            <button class="btn btn-primary" id="continue-shopping">Tiếp tục mua sắm</button>
          </div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  document.getElementById('continue-shopping').addEventListener('click', () => {
    modal.remove(); document.body.style.overflow = '';
  });
  document.getElementById('view-order-detail').addEventListener('click', () => {
    modal.remove(); document.body.style.overflow = '';
    window.location.href = `history.html?highlight=${encodeURIComponent(order.id)}`;
  });
};
