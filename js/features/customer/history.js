/**
 * history.js - Order history page/modal
 */
import { getUserOrders, getCurrentUser, formatPrice, formatDate, getReservations, calculateOrderPoints, getMenu } from '../../data/store.js';
import { openAuthModal } from './auth.js';
import { icon } from '../../ui/icons.js';
import { escapeHtml } from '../../core/html.js';

const STATUS_MAP = {
  placed:      { label: 'Đã đặt', class: 'badge-primary' },
  paid:        { label: 'Cần xác nhận', class: 'badge-warning' },
  confirmed:   { label: 'Cần xác nhận', class: 'badge-warning' },
  preparing:   { label: 'Đang thực hiện', class: 'badge-warning' },
  ready:       { label: 'Sẵn sàng', class: 'badge-success' },
  shipping:    { label: 'Đang giao', class: 'badge-primary' },
  delivered:   { label: 'Hoàn thành', class: 'badge-primary' },
  cancelled:   { label: 'Đã hủy', class: 'badge-danger' },
  preorder:    { label: 'Đặt trước', class: 'badge-primary' },
};

const PAYMENT_LABELS = {
  cash: `${icon('cash')} Tiền mặt`, bank: `${icon('bank')} Chuyển khoản`, momo: `${icon('momo')} MoMo`, vnpay: `${icon('vnpay')} VNPay`, preorder: `${icon('reservation')} Đặt trước`
};

const formatDateOnly = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const renderPointsHistoryLine = (order, isPreorder) => {
  if (isPreorder || order.status === 'cancelled') return '';
  const points = Number(order.pointsEarned ?? calculateOrderPoints(order));
  if (!Number.isFinite(points) || points <= 0) return '';
  const message = order.pointsAwarded
    ? `Bạn đã nhận ${points} điểm từ đơn hàng này.`
    : `Bạn sẽ nhận ${points} điểm sau khi hoàn thành đơn hàng.`;

  return `
    <div style="font-size:var(--font-size-xs);color:var(--color-primary-800);font-weight:600;margin-top:var(--space-1);text-align:right">
      ${icon('star')} ${message}
    </div>
  `;
};

const setupOrderCardToggles = (root) => {
  root.querySelectorAll('.order-card-header').forEach((header) => {
    header.addEventListener('click', () => {
      const card = header.closest('.order-card');
      if (!card) return;
      const expanded = card.classList.toggle('is-expanded');
      header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  });
};

const getHistoryRecordsForUser = (user) => {
  const userId = user?.id;
  const userPhone = (user?.phone || '').toString().trim();
  const orders = getUserOrders(userId);
  const preorders = (getReservations() || [])
    .filter((r) => {
      const rid = (r?.userId || '').toString();
      if (rid && rid === userId) return true;
      if (rid) return false;
      if (!userPhone) return false;
      const rPhone = (r?.phone || '').toString().trim();
      return rPhone && rPhone === userPhone;
    })
    .map((r) => {
      const qty = Number(r?.qty || 1);
      const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
      const price = Number(r?.price || 0);
      const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;
      const total = Number(r?.total);
      const safeTotal = Number.isFinite(total) && total >= 0 ? total : safePrice * safeQty;
      const itemName = (r?.itemName || '').toString().trim() || (r?.type === 'ga-nguyen-con' ? 'Gà nguyên con' : r?.type === 'vit-nguyen-con' ? 'Vịt nguyên con' : 'Đặt trước');

      return {
        id: r.id,
        status: 'preorder',
        createdAt: r.createdAt || r.date,
        preorderDate: r.date,
        address: '',
        paymentMethod: 'preorder',
        items: [{ name: itemName, qty: safeQty, price: safePrice, note: '' }],
        subtotal: safeTotal,
        discount: 0,
        total: safeTotal,
        note: (r?.note || '').toString().trim(),
      };
    });

  return [...orders, ...preorders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const showHistoryModal = (highlightId = null) => {
  const user = getCurrentUser();
  if (!user) return;

  document.getElementById('history-modal')?.remove();

  const orders = getHistoryRecordsForUser(user);
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';
  modal.id = 'history-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Lịch sử đơn hàng');

  modal.innerHTML = `
    <div class="modal" style="max-width:700px;width:100%">
      <div class="modal-header">
        <span class="modal-title">${icon('order')} Lịch sử đơn hàng</span>
        <button class="modal-close" id="history-close" aria-label="Đóng">✕</button>
      </div>
      <div class="modal-body" style="max-height:75vh;overflow-y:auto">
        ${!orders.length ? `
          <div class="empty-state">
            <div class="empty-state-icon">${icon('order', 'Lịch sử đơn hàng')}</div>
            <h3>Chưa có đơn hàng nào</h3>
            <p>Hãy đặt món ngay để trải nghiệm dịch vụ của chúng tôi!</p>
          </div>` :
          `<div class="order-list">
            ${orders.map(order => renderOrderCard(order, order.id === highlightId)).join('')}
          </div>`}
      </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  modal.querySelector('#history-close').addEventListener('click', () => {
    modal.remove(); document.body.style.overflow = '';
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; }
  });

  setupOrderCardToggles(modal);

  if (highlightId) {
    setTimeout(() => {
      modal.querySelector(`[data-order="${highlightId}"]`)?.scrollIntoView({ block: 'center' });
    }, 100);
  }
};

export const renderHistoryPage = ({ highlightId = null } = {}) => {
  // Render into normal page flow (not modal)
  document.getElementById('history-page')?.remove();

  const section = document.createElement('section');
  section.id = 'history-page';
  section.style.cssText = 'padding:var(--space-16) 0;background:var(--color-bg)';
  section.setAttribute('aria-label', 'Lịch sử đơn hàng');

  const user = getCurrentUser();
  if (!user) {
    section.innerHTML = `
      <div class="container">
        <div style="text-align:center;margin-bottom:var(--space-10)">
          <h1 class="section-title" style="font-size:var(--font-size-3xl)">${icon('order')} Lịch sử đơn hàng</h1>
        </div>
        <div class="card" style="max-width:520px;margin:0 auto">
          <div class="card-body" style="padding:var(--space-8);text-align:center">
            <div class="empty-state-icon" style="margin:0 auto var(--space-4)">🔒</div>
            <h3 style="margin-bottom:var(--space-3)">Bạn chưa đăng nhập</h3>
            <p style="color:var(--color-text-muted);margin-bottom:var(--space-6)">Đăng nhập để xem và theo dõi các đơn hàng đã đặt.</p>
            <button class="btn btn-primary" id="history-login">Đăng nhập</button>
          </div>
        </div>
      </div>`;

    document.querySelector('.page-content')?.appendChild(section);
    section.querySelector('#history-login')?.addEventListener('click', () => openAuthModal('login'));
    return;
  }

  const orders = getHistoryRecordsForUser(user);
  section.innerHTML = `
    <div class="container">
      <div style="text-align:center;margin-bottom:var(--space-10)">
        <h1 class="section-title" style="font-size:var(--font-size-3xl)">${icon('order')} Lịch sử đơn hàng</h1>
      </div>
      ${!orders.length ? `
        <div class="empty-state" style="max-width:720px;margin:0 auto">
          <div class="empty-state-icon">${icon('order', 'Lịch sử đơn hàng')}</div>
          <h3>Chưa có đơn hàng nào</h3>
          <p>Hãy đặt món ngay để trải nghiệm dịch vụ của chúng tôi!</p>
          <div style="margin-top:var(--space-5)">
            <a class="btn btn-primary" href="index.html#menu">Đặt đồ ăn</a>
          </div>
        </div>` : `
        <div class="order-list" style="max-width:860px;margin:0 auto">
          ${orders.map(order => renderOrderCard(order, order.id === highlightId)).join('')}
        </div>`}
    </div>`;

  document.querySelector('.page-content')?.appendChild(section);

  setupOrderCardToggles(section);

  if (highlightId) {
    setTimeout(() => {
      section.querySelector(`[data-order="${highlightId}"]`)?.scrollIntoView({ block: 'center' });
    }, 50);
  }
};

const renderOrderCard = (order, highlight = false) => {
  const status = STATUS_MAP[order.status] || STATUS_MAP.paid;
  const isPreorder = order.status === 'preorder' || order.paymentMethod === 'preorder';
  const menu = getMenu();
  const menuById = new Map(menu.map((item) => [item.id, item]));
  const getItemImage = (item) => {
    if (item.img) return item.img;
    const byId = item.id ? menuById.get(item.id) : null;
    if (byId?.img) return byId.img;
    const itemName = (item.name || '').toString().trim().toLowerCase();
    const byName = menu.find((m) => (m.name || '').toString().trim().toLowerCase() === itemName);
    if (byName?.img) return byName.img;
    if (itemName.includes('gà')) return 'assets/images/ga-nuong.jpg';
    if (itemName.includes('vịt')) return 'assets/images/vit-quay.jpg';
    return 'assets/images/placeholder.svg';
  };
  const totalQty = (order.items || []).reduce((sum, item) => {
    const qty = Number(item?.qty || 0);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);
  const preorderLine = isPreorder
    ? `<div class="order-meta-line">Đặt trước cho:  ${formatDateOnly(order.preorderDate || order.date) || '—'}</div>`
    : '';
  const pointsHistoryLine = renderPointsHistoryLine(order, isPreorder);
  return `
    <div class="order-card${highlight ? ' is-expanded' : ''}" data-order="${escapeHtml(order.id)}" ${highlight ? 'style="border-color:var(--color-primary-400);box-shadow:0 0 0 2px var(--color-primary-200)"' : ''}>
      <button class="order-card-header" type="button" aria-expanded="${highlight ? 'true' : 'false'}">
        <div>
          <div class="order-id" style="font-weight:700;font-size:var(--font-size-sm);color:var(--color-text)">${icon('order')} ${escapeHtml(order.id)}</div>
          <div class="order-date">${formatDate(order.createdAt)}</div>
        </div>
        <div class="order-card-header-actions">
          <span class="badge ${status.class}">${status.label}</span>
          <span class="order-card-chevron" aria-hidden="true">${icon('chevron', '', 'order-card-chevron-icon')}</span>
        </div>
      </button>
      <div class="order-card-body">
        <div class="order-card-collapsed">
          <div class="order-items-preview">
            ${(order.items || []).slice(0, 4).map(item => `
              <div class="order-item-thumb" title="${escapeHtml(item.name)} x${Number(item.qty || 0)}">
                <img src="${escapeHtml(getItemImage(item))}" alt="${escapeHtml(item.name)}" onerror="this.src='assets/images/placeholder.svg'">
              </div>`).join('')}
            ${(order.items || []).length > 4 ? `<div class="order-item-more">+${order.items.length - 4}</div>` : ''}
          </div>
          <div class="order-card-brief">
            <div class="order-card-count">${totalQty || (order.items || []).length} món</div>
            <div class="order-total">${formatPrice(order.total)}</div>
            ${pointsHistoryLine}
          </div>
        </div>
        <div class="order-card-expanded">
          ${preorderLine}
          <div class="order-items-detail">
            ${(order.items || []).map(item => `
              <div class="order-detail-item">
                <img class="order-detail-img" src="${escapeHtml(getItemImage(item))}" alt="${escapeHtml(item.name)}" onerror="this.src='assets/images/placeholder.svg'">
                <div class="order-detail-info">
                  <div class="order-detail-name">${escapeHtml(item.name)}</div>
                  ${item.note ? `<div class="order-detail-note">Ghi chú: ${escapeHtml(item.note)}</div>` : ''}
                  <div class="order-detail-qty">x${Number(item.qty || 0)} · ${formatPrice(item.price)}</div>
                </div>
                <div class="order-detail-price">${formatPrice(item.price * item.qty)}</div>
              </div>`).join('')}
          </div>
          <div class="order-card-summary">
            <div><span>Tạm tính</span><strong>${formatPrice(order.subtotal ?? order.total)}</strong></div>
            ${order.discount ? `<div><span>Voucher</span><strong class="order-discount">-${formatPrice(order.discount)}</strong></div>` : ''}
            <div><span>Phương thức thanh toán</span><strong>${PAYMENT_LABELS[order.paymentMethod] || escapeHtml(order.paymentMethod)}</strong></div>
            <div class="order-summary-total"><span>Tổng cộng</span><strong>${formatPrice(order.total)}</strong></div>
          </div>
          ${order.note ? `<div class="order-meta-line">Ghi chú: ${escapeHtml(order.note)}</div>` : ''}
          ${pointsHistoryLine}
        </div>
      </div>
    </div>`;
};
