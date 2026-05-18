import { toast } from '../../ui/toast.js';
import { requireStaff, logoutStaff } from './auth.js';
import { getOrders, saveOrders, formatPrice, formatDate, hydrateOnlineData, updateOrderStatusOnline, startOnlineRealtime } from '../../data/store.js';
import { bindStaffChrome, renderStaffShell } from './layout.js';
import { icon } from '../../ui/icons.js';
import { openStaffConfirm } from '../../ui/confirm.js';
import { escapeHtml } from '../../core/html.js';

const STATUS_MAP = {
  completed: { label: 'Thành công', class: 'badge-success' },
  cancelled: { label: 'Đã hủy', class: 'badge-danger' },
};

const normalizeStatus = (status) => {
  const key = (status || 'completed').toString();
  if (['paid', 'placed', 'pending', 'delivered'].includes(key)) return 'completed';
  return STATUS_MAP[key] ? key : 'completed';
};

const isPosOrder = (order = {}) =>
  (order?.source || '').toString() === 'pos' || /^POS-/.test((order?.id || '').toString());

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

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'completed', label: 'Thành công' },
  { id: 'cancelled', label: 'Đã huỷ' },
];

let tabId = 'all';
let selectedOrderId = null;

const getRows = () =>
  (getOrders() || [])
    .filter(isPosOrder)
    .slice()
    .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());

const filterRows = (orders, tab = tabId) =>
  (orders || []).filter((order) => tab === 'all' || normalizeStatus(order.status) === tab);

const ensureSelected = (all, filtered) => {
  if (selectedOrderId && (all || []).some((order) => order.id === selectedOrderId)) return;
  selectedOrderId = filtered?.[0]?.id || null;
};

const itemCount = (items = []) =>
  (Array.isArray(items) ? items : []).reduce((sum, item) => sum + Number(item?.qty || 0), 0);

const updatePosStatus = async (orderId, nextStatus) => {
  const all = getOrders() || [];
  const idx = all.findIndex((order) => order.id === orderId);
  if (idx === -1 || !isPosOrder(all[idx])) return false;
  if (normalizeStatus(all[idx].status) === 'cancelled') return false;

  try {
    const remoteResult = await updateOrderStatusOnline(orderId, nextStatus);
    if (remoteResult) return true;
  } catch (error) {
    toast.error(error?.message || 'Không thể cập nhật trạng thái online.');
    return false;
  }

  all[idx] = { ...all[idx], status: nextStatus, updatedAt: new Date().toISOString() };
  saveOrders(all);
  return true;
};

const renderTabs = (orders) => {
  const counts = Object.fromEntries(TABS.map((tab) => [tab.id, filterRows(orders, tab.id).length]));
  return `
    <div class="staff-tabs" role="tablist" aria-label="Phân loại đơn tại quán">
      ${TABS.map((tab) => `
        <button class="staff-tab${tab.id === tabId ? ' active' : ''}" data-tab="${tab.id}" type="button">
          ${tab.label} (${counts[tab.id] ?? 0})
        </button>
      `).join('')}
    </div>
  `;
};

const renderListItem = (order) => {
  const status = STATUS_MAP[normalizeStatus(order.status)];
  const active = order.id === selectedOrderId;
  return `
    <div class="staff-list-item${active ? ' active' : ''}" data-select="${order.id}">
      <div class="staff-kv">
        <div style="font-weight:700;font-size:var(--font-size-sm)">${icon('pos')} ${escapeHtml(order.id)}</div>
        <span class="badge ${status.class}">${status.label}</span>
      </div>
      <div class="staff-muted" style="margin-top:6px">${escapeHtml(formatDate(order.createdAt))}</div>
      <div style="margin-top:8px;display:flex;justify-content:space-between;gap:var(--space-3);align-items:flex-end">
        <div>
          <div style="font-weight:600;color:var(--color-text)">${icon('user')} ${escapeHtml(order.customerName || 'Khách tại quán')}</div>
          <div class="staff-muted" style="margin-top:4px">${icon('cart')} ${itemCount(order.items)} món</div>
        </div>
        <div style="font-weight:700;color:var(--color-primary-800)">${formatPrice(Number(order.total || 0))}</div>
      </div>
    </div>
  `;
};

const renderDetail = (order) => {
  if (!order) {
    return `<div class="empty-state" style="padding:var(--space-10) 0"><div class="empty-state-icon">${icon('pos', 'POS')}</div><h3>Chọn 1 đơn tại quán</h3><p>Chi tiết đơn sẽ hiển thị tại đây.</p></div>`;
  }

  const statusKey = normalizeStatus(order.status);
  const status = STATUS_MAP[statusKey];
  const paymentTag = getPaymentTag(order.paymentMethod);
  const items = Array.isArray(order.items) ? order.items : [];

  return `
    <div class="staff-detail-shell">
      <div class="staff-kv" style="padding:var(--space-5);padding-bottom:0;margin-bottom:var(--space-4)">
        <div>
          <div style="font-weight:700;color:var(--color-text);font-size:var(--font-size-base)">${icon('pos')} ${escapeHtml(order.id)}</div>
          <div class="staff-muted" style="margin-top:4px">${escapeHtml(formatDate(order.createdAt))}</div>
        </div>
        <div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;justify-content:flex-end">
          <span class="badge ${paymentTag.class}" style="font-size:var(--font-size-base);font-weight:600;padding:4px 14px">${paymentTag.label}</span>
          <span class="badge ${status.class}" style="font-size:var(--font-size-base);font-weight:600;padding:4px 14px">${status.label}</span>
        </div>
      </div>
      <div class="staff-detail-content">
        <div class="staff-info-grid">
          <div class="staff-info-item">${icon('user')}<span>Khách hàng</span><strong>${escapeHtml(order.customerName || 'Khách tại quán')}</strong></div>
          <div class="staff-info-item">${icon('phone')}<span>Số điện thoại</span><strong>${escapeHtml(order.customerPhone || '—')}</strong></div>
          <div class="staff-info-item staff-info-wide">${icon('location')}<span>Kênh</span><strong>Tại quán</strong></div>
        </div>
        <div style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--color-border)">
          <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:var(--space-3)">Chi tiết đơn hàng</div>
          <table style="width:100%;font-size:var(--font-size-sm);border-collapse:collapse">
            <tbody>
              ${items.map((item) => `
                <tr style="border-bottom:1px solid var(--color-beige-100)">
                  <td style="padding:6px 0">${escapeHtml(item.name || 'Món')}</td>
                  <td style="text-align:center">x${Number(item.qty || 0)}</td>
                  <td style="text-align:right;font-weight:600">${formatPrice(Number(item.price || 0) * Number(item.qty || 0))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px dashed var(--color-border)">
            <div style="font-weight:600">Tổng cộng</div>
            <div class="price" style="font-weight:700">${formatPrice(Number(order.total || 0))}</div>
          </div>
          <div class="staff-payment-line">Phương thức thanh toán: ${escapeHtml(PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || '—')}</div>
        </div>
        <div class="staff-actions staff-actions--sticky">
          ${statusKey === 'completed' ? `<button class="btn btn-danger" data-set-status="cancelled">Huỷ đơn</button>` : `<span class="staff-muted">Không còn thao tác cập nhật trạng thái.</span>`}
        </div>
      </div>
    </div>
  `;
};

const renderSelected = () => {
  const selected = selectedOrderId ? (getOrders() || []).find((order) => order.id === selectedOrderId) : null;
  const detail = document.getElementById('pos-order-detail');
  if (!detail) return;
  detail.innerHTML = renderDetail(selected);
  detail.querySelector('[data-set-status]')?.addEventListener('click', async () => {
    const ok = await openStaffConfirm({
      title: 'Huỷ đơn tại quán',
      message: 'Xác nhận cập nhật đơn POS này thành đã huỷ?',
      confirmText: 'Huỷ đơn',
      danger: true,
    });
    if (!ok) return;
    const updated = await updatePosStatus(selectedOrderId, 'cancelled');
    if (!updated) toast.error('Không thể huỷ đơn tại quán.');
    else toast.success(`Đã huỷ đơn ${selectedOrderId}.`);
    renderPage();
  });
};

const renderList = (listEl, rows) => {
  if (!listEl) return;
  listEl.innerHTML = rows.length
    ? `<div class="staff-list">${rows.map(renderListItem).join('')}</div>`
    : `<div class="empty-state" style="padding:var(--space-10) 0"><div class="empty-state-icon">${icon('pos', 'POS')}</div><h3>Không có đơn tại quán</h3><p>Đơn POS sẽ xuất hiện ở đây.</p></div>`;
  listEl.querySelectorAll('[data-select]')?.forEach((el) => {
    el.addEventListener('click', () => {
      selectedOrderId = el.dataset.select;
      renderSelected();
    });
  });
  renderSelected();
};

const renderPage = () => {
  const all = getRows();
  const filtered = filterRows(all);
  ensureSelected(all, filtered);
  const root = document.getElementById('page-content');
  root.classList.add('page-content--staff');
  root.innerHTML = renderStaffShell({
    active: 'posOrders',
    contentHtml: `
      <div class="staff-grid staff-grid--manage">
        <section class="staff-panel" aria-label="Danh sách đơn tại quán">
          <div class="staff-panel-header">${renderTabs(all)}</div>
          <div class="staff-panel-body" style="padding:var(--space-4)" id="pos-order-list"></div>
        </section>
        <section class="staff-panel" aria-label="Chi tiết đơn tại quán">
          <div class="staff-panel-header"><div class="staff-panel-title">${icon('pos')} Chi tiết</div></div>
          <div class="staff-panel-body" id="pos-order-detail"></div>
        </section>
      </div>
    `,
  });

  bindStaffChrome({
    onLogout: () => {
      logoutStaff();
      toast.success('Đã đăng xuất.');
      window.location.href = 'admin.html';
    },
  });

  const listEl = document.getElementById('pos-order-list');
  renderList(listEl, filtered);
  document.querySelectorAll('[data-tab]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabId = btn.dataset.tab;
      renderPage();
    });
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  requireStaff('admin.html');
  renderPage();
  hydrateOnlineData().then(() => renderPage()).catch(() => {});
  startOnlineRealtime(renderPage);
});
