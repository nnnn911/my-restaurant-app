import { getOrders, saveOrders, addPoints, calculateOrderPoints, formatDate, formatPrice, updateOrderStatusOnline, startOnlineRealtime } from '../../data/store.js';
import { escapeHtml, escapeAttr } from '../../core/html.js';
import { icon } from '../../ui/icons.js';
import { toast } from '../../ui/toast.js';
import { getCurrentShipper, loginShipper, logoutShipper } from './auth.js';

const STATUS_MAP = {
  ready: { label: 'Sẵn sàng giao', class: 'badge-success' },
  delivering: { label: 'Đang giao', class: 'badge-primary' },
  completed: { label: 'Thành công', class: 'badge-success' },
  cancelled: { label: 'Đã hủy', class: 'badge-danger' },
};

const PAYMENT_LABELS = {
  cash: 'COD',
  bank: 'Đã thanh toán',
  momo: 'Đã thanh toán',
  vnpay: 'Đã thanh toán',
};

let selectedOrderId = null;

const getInitials = (name = '') => {
  const parts = name.toString().trim().split(/\s+/).filter(Boolean);
  return (parts.map((part) => part[0]).join('').slice(0, 2) || 'SP').toUpperCase();
};

const getOrderItemCount = (items = []) =>
  (Array.isArray(items) ? items : []).reduce((sum, item) => {
    const qty = Number(item?.qty || 0);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);

const normalizeOrderStatus = (status) => {
  const key = (status || '').toString();
  if (key === 'shipping') return 'delivering';
  if (key === 'delivered') return 'completed';
  return key;
};

const getSortedOrders = () =>
  (getOrders() || [])
    .slice()
    .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());

const getShippingOrders = () =>
  getSortedOrders().filter((order) => {
    if ((order?.source || 'order') !== 'order') return false;
    const status = normalizeOrderStatus(order?.status);
    const shipper = getCurrentShipper();
    if (status === 'ready') return true;
    return status === 'delivering' && (!shipper?.id || order?.deliveredBy === shipper.id);
  });

const getHistoryOrders = () =>
  getSortedOrders().filter((order) => {
    const shipper = getCurrentShipper();
    return ['completed', 'cancelled'].includes(normalizeOrderStatus(order?.status))
      && (!shipper?.id || order?.deliveredBy === shipper.id);
  });

const getPaymentTag = (paymentMethod) => {
  const method = (paymentMethod || '').toString();
  return {
    label: PAYMENT_LABELS[method] || (method === 'cash' ? 'COD' : 'Đã thanh toán'),
    class: method === 'cash' ? 'badge-warning' : 'badge-success',
  };
};

const closeMobileNav = () => {
  document.getElementById('mobile-nav')?.classList.remove('open');
  document.getElementById('mobile-nav-overlay')?.classList.remove('active');
  document.getElementById('hamburger-btn')?.classList.remove('open');
  document.getElementById('hamburger-btn')?.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
};

const toggleMobileNav = () => {
  const mobileNav = document.getElementById('mobile-nav');
  const overlay = document.getElementById('mobile-nav-overlay');
  const hamburger = document.getElementById('hamburger-btn');
  const open = mobileNav?.classList.toggle('open');
  hamburger?.classList.toggle('open', open);
  hamburger?.setAttribute('aria-expanded', open ? 'true' : 'false');
  overlay?.classList.toggle('active', open);
  document.body.style.overflow = open ? 'hidden' : '';
};

const renderShipperNavbar = () => {
  document.getElementById('navbar')?.remove();
  document.getElementById('mobile-nav-overlay')?.remove();
  document.getElementById('mobile-nav')?.remove();

  const shipper = getCurrentShipper();
  const initials = getInitials(shipper?.name || 'Shipper');
  const nav = document.createElement('nav');
  nav.className = 'navbar shipper-navbar';
  nav.id = 'navbar';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Thanh điều hướng shipper');
  nav.innerHTML = `
    <div class="navbar-inner">
      <button class="hamburger-btn" id="hamburger-btn" aria-label="Mở menu" aria-expanded="false">
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
      </button>
      <a href="shipper.html" class="navbar-logo" aria-label="Quán Ăn Đồng Quê - Shipper">
        <img class="navbar-logo-icon" src="assets/logos/logo-white.svg" alt="" aria-hidden="true">
        <div class="navbar-logo-text">
          <span class="navbar-logo-name">Đồng Quê</span>
          <span class="navbar-logo-tagline">Shipper</span>
        </div>
      </a>
      <div class="navbar-nav" role="menubar" aria-label="Điều hướng"></div>
      <div class="navbar-actions" aria-hidden="true"></div>
    </div>
  `;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'mobile-nav-overlay';

  const mobileNav = document.createElement('aside');
  mobileNav.className = 'mobile-nav shipper-mobile-nav';
  mobileNav.id = 'mobile-nav';
  mobileNav.setAttribute('aria-label', 'Menu điều hướng shipper mobile');
  mobileNav.innerHTML = `
    <div class="mobile-nav-inner">
      <div class="mobile-user" id="mobile-user-area">
        ${shipper ? `
          <div class="mobile-user-header">
            <div class="profile-avatar">${escapeHtml(initials)}</div>
            <div class="mobile-user-meta">
              <div class="mobile-user-name">${escapeHtml(shipper.name)}</div>
              <div class="mobile-user-phone">${escapeHtml(shipper.id || '')} · ${escapeHtml(shipper.phone || '')}</div>
            </div>
          </div>
          <div class="mobile-user-actions">
            <button class="mobile-user-action mobile-logout" id="m-btn-logout">${icon('logout')} Đăng xuất</button>
          </div>
        ` : `
          <div class="mobile-user-header">
            <div class="profile-avatar">SP</div>
            <div class="mobile-user-meta">
              <div class="mobile-user-name">Shipper</div>
              <div class="mobile-user-phone">Vui lòng đăng nhập</div>
            </div>
          </div>
        `}
      </div>
      <div class="mobile-nav-sep" role="separator" aria-hidden="true"></div>
      <nav class="mobile-nav-links" aria-label="Danh mục">
        <a class="mobile-nav-link${getCurrentView() === 'history' ? ' active' : ''}" href="shipper.html?view=history">${icon('order')} Lịch sử đơn hàng</a>
      </nav>
    </div>
  `;

  document.body.prepend(nav);
  document.body.appendChild(overlay);
  document.body.appendChild(mobileNav);

  document.getElementById('hamburger-btn')?.addEventListener('click', toggleMobileNav);
  document.getElementById('mobile-nav-overlay')?.addEventListener('click', closeMobileNav);
  document.getElementById('m-btn-logout')?.addEventListener('click', async () => {
    const ok = await showConfirmModal({
      title: 'Đăng xuất',
      message: 'Bạn có chắc muốn đăng xuất khỏi tài khoản shipper?',
      confirmText: 'Đăng xuất',
      danger: true,
    });
    if (!ok) return;
    logoutShipper();
    toast.success('Đã đăng xuất.');
    window.location.href = 'shipper.html';
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMobileNav();
  });
};

const getCurrentView = () => new URLSearchParams(window.location.search).get('view') === 'history' ? 'history' : 'active';

const showLogin = () => {
  const root = document.getElementById('page-content');
  root.classList.add('shipper-page');
  root.innerHTML = `
    <section class="shipper-login" aria-label="Đăng nhập shipper">
      <div class="shipper-login-card">
        <div class="shipper-login-mark">${icon('order', 'Shipper', 'app-icon icon-lg')}</div>
        <h1>Shipper Đồng Quê</h1>
        <p>Đăng nhập để nhận và cập nhật đơn giao hàng.</p>
        <form id="shipper-login-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="shipper-phone">Số điện thoại</label>
            <div class="input-group">
              <span class="input-icon" aria-hidden="true">${icon('phone')}</span>
              <input class="form-control" type="tel" id="shipper-phone" autocomplete="tel" placeholder="Nhập số điện thoại" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="shipper-password">Mật khẩu</label>
            <div class="input-group">
              <span class="input-icon" aria-hidden="true">${icon('password')}</span>
              <input class="form-control" type="password" id="shipper-password" autocomplete="current-password" placeholder="Nhập mật khẩu" required>
            </div>
          </div>
          <div id="shipper-login-error" class="form-error" style="display:none;margin-bottom:var(--space-4)"></div>
          <button class="btn btn-primary btn-block btn-lg" type="submit">Đăng nhập</button>
        </form>
      </div>
    </section>
  `;

  document.getElementById('shipper-login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errEl = document.getElementById('shipper-login-error');
    const phone = document.getElementById('shipper-phone')?.value.trim() || '';
    const password = document.getElementById('shipper-password')?.value || '';
    errEl.style.display = 'none';
    if (!phone || !password) {
      errEl.textContent = 'Vui lòng nhập đầy đủ thông tin.';
      errEl.style.display = 'flex';
      return;
    }
    const result = await loginShipper(phone, password);
    if (!result.ok) {
      errEl.textContent = result.msg;
      errEl.style.display = 'flex';
      return;
    }
    toast.success(`Chào mừng, ${result.shipper.name}!`);
    renderShipperNavbar();
    renderPage();
  });
};

const renderOrderCard = (order) => {
  const payment = getPaymentTag(order.paymentMethod);
  const itemCount = getOrderItemCount(order.items);
  return `
    <button class="shipper-order-card" type="button" data-order-id="${escapeAttr(order.id)}">
      <div class="shipper-card-top">
        <span class="shipper-order-id">${icon('order')} ${escapeHtml(order.id)}</span>
        <span class="badge ${payment.class}">${escapeHtml(payment.label)}</span>
      </div>
      <div class="shipper-card-address">${icon('location')} ${escapeHtml(order.address || 'Chưa có địa chỉ')}</div>
      <div class="shipper-card-bottom">
        <span>${Number(itemCount || 0).toLocaleString('vi-VN')} món</span>
        <strong>${formatPrice(Number(order.total || 0))}</strong>
      </div>
    </button>
  `;
};

const renderActiveList = () => {
  const orders = getShippingOrders();
  return `
    <section class="shipper-screen" aria-label="Đơn cần giao">
      <div class="shipper-screen-header">
        <div>
          <h1>Cần giao</h1>
          <p>Các đơn bạn cần giao ngay</p>
        </div>
        <div class="shipper-count" aria-label="${orders.length} đơn cần giao">${orders.length}</div>
      </div>
      ${orders.length ? `
        <div class="shipper-order-list">
          ${orders.map(renderOrderCard).join('')}
        </div>
      ` : `
        <div class="empty-state shipper-empty">
          <div class="empty-state-icon">${icon('order', 'Đơn hàng')}</div>
          <h3>Chưa có đơn cần giao</h3>
          <p>Các đơn bạn cần giao sẽ xuất hiện tại đây.</p>
        </div>
      `}
    </section>
  `;
};

const renderHistory = () => {
  const orders = getHistoryOrders();
  const activeCount = getShippingOrders().length;
  return `
    <section class="shipper-screen" aria-label="Lịch sử đơn hàng">
      <div class="shipper-screen-header">
        <div>
          <h1>Lịch sử đơn hàng</h1>
          <p>Các đơn đã giao</p>
        </div>
        <a class="btn btn-outline btn-sm" href="shipper.html">Trở về đơn cần giao (${activeCount})</a>
      </div>
      ${orders.length ? `
        <div class="shipper-order-list">
          ${orders.map((order) => {
            const status = STATUS_MAP[normalizeOrderStatus(order.status)] || STATUS_MAP.cancelled;
            return renderOrderCard(order).replace('</button>', `<div class="shipper-card-status"><span class="badge ${status.class}">${status.label}</span></div></button>`);
          }).join('')}
        </div>
      ` : `
        <div class="empty-state shipper-empty">
          <div class="empty-state-icon">${icon('order', 'Lịch sử đơn hàng')}</div>
          <h3>Chưa có lịch sử</h3>
          <p>Các đơn giao thành công hoặc thất bại sẽ nằm ở đây.</p>
        </div>
      `}
    </section>
  `;
};

const orderDetailHtml = (order) => {
  const status = STATUS_MAP[normalizeOrderStatus(order.status)] || { label: 'Đang xử lý', class: 'badge-warning' };
  const payment = getPaymentTag(order.paymentMethod);
  const items = Array.isArray(order.items) ? order.items : [];
  const statusKey = normalizeOrderStatus(order.status);
  const isReady = statusKey === 'ready';
  const isDelivering = statusKey === 'delivering';
  const isCod = (order.paymentMethod || '').toString() === 'cash';
  const cashNotice = isCod
    ? `Bạn cần thu khách hàng ${formatPrice(Number(order.total || 0))}.`
    : 'Bạn không cần thu tiền mặt.';

  return `
    <section class="shipper-detail" aria-label="Chi tiết đơn hàng">
      <div class="shipper-detail-head">
        <button class="btn btn-outline btn-sm" type="button" id="shipper-back">${icon('chevron')} Quay lại</button>
      </div>

      <div class="shipper-detail-title">
        <div class="shipper-detail-title-row">
          <div>
            <h1>${escapeHtml(order.id)}</h1>
            <span>${escapeHtml(formatDate(order.createdAt))}</span>
          </div>
          <div class="shipper-detail-badges">
            <span class="badge ${payment.class}">${escapeHtml(payment.label)}</span>
          </div>
        </div>
        <div class="shipper-cash-notice ${isCod ? 'is-cod' : 'is-paid'}">${escapeHtml(cashNotice)}</div>
      </div>

      <div class="shipper-info-block">
        <div>
          <span>Khách hàng</span>
          <strong>${escapeHtml(order.customerName || 'Khách hàng')}</strong>
        </div>
        <div>
          <span>Số điện thoại</span>
          <strong>${escapeHtml(order.customerPhone || '—')}</strong>
        </div>
        <div class="shipper-info-wide">
          <span>Địa chỉ</span>
          <strong>${escapeHtml(order.address || 'Chưa có địa chỉ')}</strong>
        </div>
        ${order.note ? `
          <div class="shipper-info-wide">
            <span>Ghi chú</span>
            <strong>${escapeHtml(order.note)}</strong>
          </div>
        ` : ''}
      </div>

      <div class="shipper-items">
        <h2>Chi tiết món</h2>
        ${items.map((item) => `
          <div class="shipper-item-row">
            <div>
              <strong>${escapeHtml(item.name || 'Món')}</strong>
              ${item.note ? `<span>Ghi chú: ${escapeHtml(item.note)}</span>` : ''}
            </div>
            <div class="shipper-item-qty">x${Number(item.qty || 0)}</div>
            <div class="shipper-item-price">${formatPrice(Number(item.price || 0) * Number(item.qty || 0))}</div>
          </div>
        `).join('') || '<div class="shipper-muted">Không có món.</div>'}
      </div>

      <div class="shipper-total">
        <div><span>Số món</span><strong>${Number(getOrderItemCount(items)).toLocaleString('vi-VN')}</strong></div>
        <div><span>Tạm tính</span><strong>${formatPrice(Number(order.subtotal || order.total || 0))}</strong></div>
        <div><span>Giảm giá</span><strong>-${formatPrice(Number(order.discount || 0))}</strong></div>
        <div><span>Thanh toán</span><strong>${escapeHtml(payment.label)}</strong></div>
        <div class="shipper-grand-total"><span>Tổng cộng</span><strong>${formatPrice(Number(order.total || 0))}</strong></div>
      </div>

      ${isReady ? `
        <div class="shipper-action-bar">
          <button class="btn btn-primary btn-lg shipper-success-btn" type="button" data-shipper-status="delivering">Giao đơn</button>
        </div>
      ` : isDelivering ? `
        <div class="shipper-action-bar">
          <button class="btn btn-danger btn-lg shipper-fail-btn" type="button" data-shipper-status="cancelled" aria-label="Giao hàng thất bại">${icon('close')}</button>
          <button class="btn btn-primary btn-lg shipper-success-btn" type="button" data-shipper-status="completed">Thành công</button>
        </div>
      ` : ''}
    </section>
  `;
};

const showConfirmModal = ({ title, message, confirmText = 'Xác nhận', danger = false } = {}) =>
  new Promise((resolve) => {
    document.getElementById('shipper-confirm-modal')?.remove();
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop active shipper-confirm-modal';
    modal.id = 'shipper-confirm-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', title);
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${escapeHtml(title)}</span>
          <button class="modal-close" type="button" data-confirm-cancel aria-label="Đóng">${icon('close')}</button>
        </div>
        <div class="modal-body">
          <p class="shipper-confirm-text">${escapeHtml(message)}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" type="button" data-confirm-cancel>Quay lại</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-confirm-ok>${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    const close = (value) => {
      modal.remove();
      document.body.style.overflow = '';
      resolve(value);
    };

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close(false);
    });
    modal.querySelectorAll('[data-confirm-cancel]').forEach((btn) => btn.addEventListener('click', () => close(false)));
    modal.querySelector('[data-confirm-ok]')?.addEventListener('click', () => close(true));
  });

const updateOrderStatus = async (orderId, nextStatus) => {
  const all = getOrders() || [];
  const idx = all.findIndex((order) => order.id === orderId);
  if (idx === -1) return false;
  const currentStatus = normalizeOrderStatus(all[idx]?.status);
  const canReceive = currentStatus === 'ready' && nextStatus === 'delivering';
  const canFinish = currentStatus === 'delivering' && ['completed', 'cancelled'].includes(nextStatus);
  if (!canReceive && !canFinish) return false;

  try {
    const remoteResult = await updateOrderStatusOnline(orderId, nextStatus);
    if (remoteResult) return true;
  } catch (error) {
    toast.error(error?.message || 'Không thể cập nhật trạng thái online.');
    return false;
  }

  const updatedOrder = {
    ...all[idx],
    status: nextStatus,
    deliveredBy: getCurrentShipper()?.id || null,
    updatedAt: new Date().toISOString(),
  };
  const pointsEarned = calculateOrderPoints(updatedOrder);

  if (nextStatus === 'completed' && !updatedOrder.pointsAwarded && pointsEarned > 0) {
    const awardedUser = addPoints(updatedOrder.userId, pointsEarned);
    if (awardedUser) {
      updatedOrder.pointsEarned = pointsEarned;
      updatedOrder.pointsAwarded = true;
      updatedOrder.pointsAwardedAt = new Date().toISOString();
    }
  }

  all[idx] = updatedOrder;
  saveOrders(all);
  return true;
};

const bindOrderCards = () => {
  document.querySelectorAll('[data-order-id]').forEach((card) => {
    card.addEventListener('click', () => {
      selectedOrderId = card.dataset.orderId;
      renderPage();
    });
  });
};

const bindDetail = () => {
  document.getElementById('shipper-back')?.addEventListener('click', () => {
    selectedOrderId = null;
    renderPage();
  });

  document.querySelectorAll('[data-shipper-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nextStatus = btn.dataset.shipperStatus;
      const isCancel = nextStatus === 'cancelled';
      const isReceive = nextStatus === 'delivering';
      const ok = await showConfirmModal({
        title: isReceive ? 'Xác nhận nhận giao đơn' : isCancel ? 'Xác nhận giao hàng thất bại' : 'Xác nhận giao hàng thành công',
        message: isReceive
          ? 'Đơn hàng sẽ chuyển sang trạng thái đang giao.'
          : isCancel
          ? 'Đơn hàng sẽ được cập nhật thành bị hủy trên toàn hệ thống.'
          : 'Đơn hàng sẽ được cập nhật thành thành công trên toàn hệ thống.',
        confirmText: 'Xác nhận',
        danger: isCancel,
      });
      if (!ok) return;
      const updated = await updateOrderStatus(selectedOrderId, nextStatus);
      if (!updated) {
        toast.error('Không thể cập nhật đơn hàng này.');
        selectedOrderId = null;
        renderPage();
        return;
      }
      toast.success(isReceive ? 'Đã nhận giao đơn.' : isCancel ? 'Đã cập nhật giao hàng thất bại.' : 'Đã cập nhật giao hàng thành công.');
      if (!isReceive) selectedOrderId = null;
      renderPage();
    });
  });
};

const renderPage = () => {
  const root = document.getElementById('page-content');
  root.classList.add('shipper-page');

  if (!getCurrentShipper()) {
    showLogin();
    return;
  }

  const selected = selectedOrderId ? (getOrders() || []).find((order) => order.id === selectedOrderId) : null;
  root.innerHTML = selected ? orderDetailHtml(selected) : getCurrentView() === 'history' ? renderHistory() : renderActiveList();
  bindOrderCards();
  bindDetail();
};

export const initShipperPage = () => {
  renderShipperNavbar();
  renderPage();
  startOnlineRealtime(renderPage);
};
