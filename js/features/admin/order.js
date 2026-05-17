import { toast } from '../../ui/toast.js';
import { requireStaff, logoutStaff } from './auth.js';
import { getOrders, saveOrders, addPoints, calculateOrderPoints, formatPrice, formatDate, hydrateOnlineData, updateOrderStatusOnline, startOnlineRealtime } from '../../data/store.js';
import { bindStaffChrome, renderStaffShell } from './layout.js';
import { icon } from '../../ui/icons.js';
import { openStaffConfirm } from '../../ui/confirm.js';
import { escapeHtml } from '../../core/html.js';

const STATUS_MAP = {
  placed: { label: 'Đã đặt', class: 'badge-primary' },
  paid: { label: 'Cần xác nhận', class: 'badge-warning' },
  confirmed: { label: 'Cần xác nhận', class: 'badge-warning' },
  preparing: { label: 'Đang thực hiện', class: 'badge-warning' },
  ready: { label: 'Sẵn sàng', class: 'badge-success' },
  shipping: { label: 'Đang được giao', class: 'badge-primary' },
  delivered: { label: 'Hoàn thành', class: 'badge-primary' },
  cancelled: { label: 'Đã hủy', class: 'badge-danger' },
};

const STATUS_FLOW = ['paid', 'preparing', 'ready', 'shipping'];

const normalizeOrderStatus = (status) => {
  const key = (status || 'paid').toString();
  if (key === 'confirmed') return 'paid';
  return STATUS_MAP[key] ? key : 'paid';
};

const getNextAction = (statusKey) => {
  const actions = {
    paid: { nextStatus: 'preparing', label: 'Xác nhận đơn', confirm: 'Xác nhận đơn và chuyển sang trạng thái đang chuẩn bị?' },
    preparing: { nextStatus: 'ready', label: 'Đơn sẵn sàng', confirm: 'Xác nhận đơn đã sẵn sàng?' },
    ready: { nextStatus: 'shipping', label: 'Đã giao cho shipper', confirm: 'Xác nhận đã giao đơn cho shipper?' },
    shipping: { nextStatus: 'delivered', label: 'Hoàn thành đơn', confirm: 'Xác nhận đơn hàng đã hoàn thành?' },
  };
  return actions[statusKey] || null;
};

const isPosOrder = (order = {}) =>
  (order?.source || '').toString() === 'pos' || /^POS-/.test((order?.id || '').toString());

const canCancelOrder = (statusKey, order = null) => {
  if (isPosOrder(order)) return statusKey !== 'cancelled';
  return ['paid', 'preparing', 'ready'].includes(statusKey);
};

const PAYMENT_LABELS = {
  cash: 'Tiền mặt',
  bank: 'Chuyển khoản',
  momo: 'MoMo',
  vnpay: 'VNPay',
};

const getPaymentTag = (paymentMethod) => {
  const method = (paymentMethod || '').toString();
  return method === 'cash'
    ? { label: 'COD', class: 'badge-warning' }
    : { label: 'Đã thanh toán', class: 'badge-success' };
};

const getOrderItemCount = (items = []) =>
  (Array.isArray(items) ? items : []).reduce((sum, item) => {
    const qty = Number(item?.qty || 0);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);

const TABS = [
  { id: 'need', label: 'Cần xác nhận' },
  { id: 'doing', label: 'Đang thực hiện' },
  { id: 'ready', label: 'Sẵn sàng' },
  { id: 'success', label: 'Hoàn thành' },
  { id: 'all', label: 'Tất cả' },
];

let tabId = 'need';
let searchQuery = '';
let selectedOrderId = null;

const getSortedOrders = () => {
  const all = getOrders() || [];
  return all
    .slice()
    .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
};

const matchesTab = (status, tab) => {
  const statusKey = normalizeOrderStatus(status);
  if (tab === 'need') return statusKey === 'paid';
  if (tab === 'doing') return statusKey === 'preparing';
  if (tab === 'ready') return statusKey === 'ready';
  if (tab === 'success') return ['shipping', 'delivered'].includes(statusKey);
  return true;
};

const filterOrders = (orders, tab = tabId) => {
  const q = (searchQuery || '').trim().toLowerCase();
  return (orders || []).filter((o) => {
    const status = normalizeOrderStatus(o?.status);
    if (!matchesTab(status, tab)) return false;
    if (!q) return true;
    const hay = `${o?.id || ''} ${o?.customerName || ''} ${o?.customerPhone || ''}`.toLowerCase();
    return hay.includes(q);
  });
};

const ensureSelected = (all, filtered) => {
  if (selectedOrderId && (all || []).some((o) => o.id === selectedOrderId)) return;
  if (!(filtered || []).length) {
    selectedOrderId = null;
    return;
  }
  selectedOrderId = filtered[0].id;
};

const updateOrderStatus = async (orderId, nextStatus) => {
  const all = getOrders() || [];
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx === -1) return false;
  const currentStatus = normalizeOrderStatus(all[idx]?.status);
  const isPos = isPosOrder(all[idx]);
  const allowedNext = isPos ? null : getNextAction(currentStatus)?.nextStatus;
  const canMoveForward = !isPos && nextStatus === allowedNext;
  const canCancel = nextStatus === 'cancelled' && canCancelOrder(currentStatus, all[idx]);
  if (!canMoveForward && !canCancel) return false;

  try {
    const remoteResult = await updateOrderStatusOnline(orderId, nextStatus);
    if (remoteResult) return true;
  } catch (error) {
    toast.error(error?.message || 'Không thể cập nhật trạng thái online.');
    return false;
  }

  const updatedOrder = { ...all[idx], status: nextStatus, updatedAt: new Date().toISOString() };
  const pointsEarned = calculateOrderPoints(updatedOrder);

  if (nextStatus === 'delivered' && !updatedOrder.pointsAwarded && pointsEarned > 0) {
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

const renderTabs = (orders) => {
  const counts = Object.fromEntries(TABS.map((t) => [t.id, filterOrders(orders, t.id).length]));
  return `
  <div class="staff-tabs" role="tablist" aria-label="Phân loại">
    ${TABS.map((t) => `
      <button class="staff-tab${t.id === tabId ? ' active' : ''}" data-tab="${t.id}" type="button">${t.label} (${counts[t.id] ?? 0})</button>
    `).join('')}
  </div>
`;
};

const renderListItem = (o) => {
  const isActive = o.id === selectedOrderId;
  const statusKey = normalizeOrderStatus(o.status);
  const status = STATUS_MAP[statusKey];
  const itemCount = getOrderItemCount(o.items);
  const customerLine = `${o.customerName || '—'} | ${o.customerPhone || '—'}`;
  return `
    <div class="staff-list-item${isActive ? ' active' : ''}" data-select="${o.id}">
      <div class="staff-kv">
        <div style="font-weight:700;font-size:var(--font-size-sm)">${icon('order')} ${escapeHtml(o.id)}</div>
        <span class="badge ${status.class}">${status.label}</span>
      </div>
      <div class="staff-muted" style="margin-top:6px">${escapeHtml(formatDate(o.createdAt))}</div>
      <div style="margin-top:8px;display:flex;justify-content:space-between;gap:var(--space-3);align-items:flex-end">
        <div>
          <div style="font-weight:600;color:var(--color-text)">${escapeHtml(customerLine)}</div>
          <div class="staff-muted" style="margin-top:4px">${itemCount || 0} món</div>
        </div>
        <div style="font-weight:700;color:var(--color-primary-800)">${formatPrice(Number(o.total || 0))}</div>
      </div>
    </div>
  `;
};

const renderDetail = (o) => {
  if (!o) {
    return `
      <div class="empty-state" style="padding:var(--space-10) 0">
        <div class="empty-state-icon">${icon('order', 'Đơn hàng')}</div>
        <h3>Chọn 1 đơn để xem</h3>
        <p>Chọn 1 đơn từ danh sách để xem chi tiết.</p>
      </div>
    `;
  }

  const statusKey = normalizeOrderStatus(o.status);
  const status = STATUS_MAP[statusKey];
  const items = Array.isArray(o.items) ? o.items : [];
  const isPos = isPosOrder(o);
  const nextAction = isPos ? null : getNextAction(statusKey);
  const paymentTag = getPaymentTag(o.paymentMethod);
  const inShipping = statusKey === 'shipping';
  const canCancel = canCancelOrder(statusKey, o);

  return `
    <div>
      <div class="staff-kv" style="padding:var(--space-5);padding-bottom:0;margin-bottom:var(--space-4)">
        <div>
          <div style="font-weight:700;color:var(--color-text);font-size:var(--font-size-base)">${icon('order')} ${escapeHtml(o.id)}</div>
          <div class="staff-muted" style="margin-top:4px">${escapeHtml(formatDate(o.createdAt))}</div>
        </div>
        <div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;justify-content:flex-end">
          <span class="badge ${paymentTag.class}" style="font-size:var(--font-size-base);font-weight:600;padding:4px 14px">${paymentTag.label}</span>
          <span class="badge ${status.class}" style="font-size:var(--font-size-base);font-weight:600;padding:4px 14px">${status.label}</span>
        </div>
      </div>

      <div style="padding:var(--space-5)">
        <div class="staff-kv">
          <div>
            <div style="font-weight:600;color:var(--color-text);font-size:var(--font-size-sm)">${escapeHtml(o.customerName || '—')}</div>
            <div class="staff-muted" style="margin-top:4px">${escapeHtml(o.customerPhone || '—')}</div>
            <div class="staff-muted" style="margin-top:4px">${escapeHtml((o.address || 'Tại quán').toString())}</div>
          </div>
        </div>

        <div style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--color-border)">
          <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:var(--space-3)">Chi tiết đơn hàng</div>
          <table style="width:100%;font-size:var(--font-size-sm);border-collapse:collapse">
            <thead>
              <tr style="text-align:left;color:var(--color-text-muted);border-bottom:1px solid var(--color-border)">
                <th style="padding:4px 0">Món</th><th style="text-align:center">SL</th><th style="text-align:right">Giá</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((it) => `
                <tr style="border-bottom:1px solid var(--color-beige-100)">
                  <td style="padding:6px 0">
                    <div>${escapeHtml(it.name)}</div>
                    ${it.note ? `<div style="color:var(--color-text-muted);font-size:var(--font-size-xs);margin-top:2px">Ghi chú: ${escapeHtml(it.note)}</div>` : ''}
                  </td>
                  <td style="text-align:center">x${it.qty}</td>
                  <td style="text-align:right;font-weight:600">${formatPrice(Number(it.price || 0) * Number(it.qty || 0))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${o.note ? `<div style="margin-top:8px" class="staff-muted">Ghi chú: ${escapeHtml(o.note)}</div>` : ''}
          <div style="display:flex;justify-content:space-between;margin-top:10px">
            <div class="staff-muted">Tổng tiền hàng</div>
            <div style="font-weight:600">${formatPrice(Number(o.subtotal || 0))}</div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px">
            <div class="staff-muted">Giảm giá</div>
            <div style="font-weight:600">-${formatPrice(Number(o.discount || 0))}</div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px dashed var(--color-border)">
            <div style="font-weight:600">Tổng cộng</div>
            <div class="price" style="font-weight:700">${formatPrice(Number(o.total || 0))}</div>
          </div>
          <div class="staff-muted" style="margin-top:10px;text-align:right">Hình thức thanh toán: ${escapeHtml(PAYMENT_LABELS[o.paymentMethod] || (o.paymentMethod || '—'))}</div>
        </div>

        <div class="staff-actions" id="order-actions" style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--color-border);justify-content:flex-end">
          ${inShipping ? `
            <button class="btn btn-outline" type="button" disabled>
              Đơn đang được giao
            </button>
          ` : nextAction ? `
            <button class="btn btn-primary" data-set-status="${nextAction.nextStatus}" data-confirm="${escapeHtml(nextAction.confirm)}">
              ${escapeHtml(nextAction.label)}
            </button>
          ` : canCancel ? '' : `<span class="staff-muted">Không còn thao tác cập nhật trạng thái.</span>`}
          ${!inShipping && canCancel ? `
            <button class="btn btn-danger" data-set-status="cancelled" data-confirm="Xác nhận hủy đơn hàng?">
              Huỷ đơn
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
};

const renderSelectedOrderDetail = () => {
  const selected = selectedOrderId ? (getOrders() || []).find((o) => o.id === selectedOrderId) : null;
  const detailEl = document.getElementById('order-detail');
  if (!detailEl) return;

  detailEl.innerHTML = renderDetail(selected);
  detailEl.querySelectorAll('[data-set-status]')?.forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!selectedOrderId) return;
      const next = btn.dataset.setStatus;
      const ok = await openStaffConfirm({
        title: 'Xác nhận cập nhật',
        message: btn.dataset.confirm || 'Xác nhận cập nhật trạng thái đơn hàng?',
        confirmText: next === 'cancelled' ? 'Huỷ đơn' : 'Xác nhận',
        danger: next === 'cancelled',
      });
      if (!ok) return;
      const updated = await updateOrderStatus(selectedOrderId, next);
      if (!updated) {
        toast.error('Không thể cập nhật ngược hoặc bỏ qua bước trạng thái.');
        renderPage();
        return;
      }
      toast.success(`Đã cập nhật trạng thái ${selectedOrderId}.`);
      renderPage();
    });
  });
};

const renderOrderList = (listEl, rows) => {
  if (!listEl) return;

  if (!rows.length) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:var(--space-10) 0">
        <div class="empty-state-icon">${icon('order', 'Đơn hàng')}</div>
        <h3>Không có đơn hàng</h3>
        <p>${searchQuery ? 'Không tìm thấy đơn phù hợp.' : 'Chưa có đơn nào trong hệ thống.'}</p>
      </div>
    `;
  } else {
    listEl.innerHTML = `<div class="staff-list">${rows.map(renderListItem).join('')}</div>`;
    listEl.querySelectorAll('[data-select]')?.forEach((el) => {
      el.addEventListener('click', () => {
        selectedOrderId = el.dataset.select;
        listEl.querySelectorAll('[data-select]').forEach((item) => {
          item.classList.toggle('active', item.dataset.select === selectedOrderId);
        });
        renderSelectedOrderDetail();
      });
    });
  }

  renderSelectedOrderDetail();
};

const renderPage = () => {
  const all = getSortedOrders();
  const filtered = filterOrders(all);
  ensureSelected(all, filtered);

  const root = document.getElementById('page-content');
  root.classList.add('page-content--staff');
  root.innerHTML = renderStaffShell({
    active: 'order',
    pageTitle: '',
    pageSubtitle: '',
    contentHtml: `
      <div class="staff-grid staff-grid--manage">
        <section class="staff-panel" aria-label="Danh sách đơn hàng">
          <div class="staff-panel-header">
            <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap">
              ${renderTabs(all)}
              <div class="search-bar" style="max-width:420px;min-width:260px">
                <span class="search-icon" aria-hidden="true">${icon('search')}</span>
                <input type="search" id="order-search" placeholder="Tìm mã đơn / tên / SĐT" aria-label="Tìm đơn hàng" value="${(searchQuery || '').replaceAll('"', '&quot;')}">
              </div>
            </div>
          </div>
          <div class="staff-panel-body" style="padding:var(--space-4)" id="order-list"></div>
        </section>

        <section class="staff-panel" aria-label="Chi tiết đơn">
          <div class="staff-panel-header">
            <div class="staff-panel-title">${icon('order')} Chi tiết</div>
          </div>
          <div class="staff-panel-body" id="order-detail"></div>
        </section>
      </div>
    `,
  });

  const doLogout = () => {
    logoutStaff();
    toast.success('Đã đăng xuất.');
    window.location.href = 'admin.html';
  };
  bindStaffChrome({ onLogout: doLogout });

  const listEl = document.getElementById('order-list');
  renderOrderList(listEl, filtered);

  // bind tabs
  document.querySelectorAll('[data-tab]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabId = btn.dataset.tab;
      renderPage();
    });
  });

  // bind search
  document.getElementById('order-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    const nextFiltered = filterOrders(all);
    ensureSelected(all, nextFiltered);
    renderOrderList(listEl, nextFiltered);
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  await hydrateOnlineData();
  requireStaff('admin.html');
  renderPage();
  startOnlineRealtime(renderPage);
});
