import { toast } from '../../ui/toast.js';
import { requireStaff, logoutStaff } from './auth.js';
import { getReservations, saveReservations, formatPrice, formatDate, hydrateOnlineData, startOnlineRealtime, createReservationOnline, updateReservationStatusOnline, addPoints, calculateOrderPoints } from '../../data/store.js';
import { bindStaffChrome, renderStaffShell } from './layout.js';
import { icon } from '../../ui/icons.js';
import { openStaffConfirm } from '../../ui/confirm.js';
import { escapeAttr, escapeHtml } from '../../core/html.js';

const RES_STATUS = {
  pending: { label: 'Chờ xác nhận', class: 'badge-warning' },
  preparing: { label: 'Đang thực hiện', class: 'badge-warning' },
  ready: { label: 'Sẵn sàng để pickup', class: 'badge-success' },
  completed: { label: 'Thành công', class: 'badge-success' },
  cancelled: { label: 'Đã hủy', class: 'badge-danger' },
};

const normalizeReservationStatus = (status) => {
  const key = (status || 'pending').toString();
  if (key === 'confirmed') return 'preparing';
  if (key === 'done') return 'completed';
  return RES_STATUS[key] ? key : 'pending';
};

const getNextReservationAction = (statusKey) => {
  const actions = {
    pending: { nextStatus: 'preparing', label: 'Xác nhận đơn', confirm: 'Xác nhận đơn và chuyển sang trạng thái đang thực hiện?' },
    preparing: { nextStatus: 'ready', label: 'Đơn sẵn sàng để pickup', confirm: 'Xác nhận đơn đã sẵn sàng để pickup?' },
    ready: { nextStatus: 'completed', label: 'Thành công', confirm: 'Xác nhận khách đã pickup đơn?' },
  };
  return actions[statusKey] || null;
};

const canCancelReservation = (statusKey) => ['pending', 'preparing', 'ready'].includes(statusKey);

const TABS = [
  { id: 'need', label: 'Chờ xác nhận' },
  { id: 'doing', label: 'Đang thực hiện' },
  { id: 'ready', label: 'Sẵn sàng pickup' },
  { id: 'all', label: 'Tất cả' },
];

const STAFF_PREORDER_ITEMS = [
  { type: 'ga-nguyen-con', itemName: 'Gà nguyên con', price: 290000 },
  { type: 'vit-nguyen-con', itemName: 'Vịt nguyên con', price: 390000 },
];

let tabId = 'need';
let searchQuery = '';
let statusFilter = 'all';
let dateFilter = '';
let selectedResId = null;

const formatDateOnly = (iso) => {
  const s = (iso || '').toString().trim();
  if (!s) return '';
  // 'YYYY-MM-DD' from customer preorder
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('vi-VN');
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('vi-VN');
};

const formatReservationTimestamp = (r) => {
  const createdAt = (r?.createdAt || '').toString().trim();
  if (createdAt) return formatDate(createdAt);
  return formatDateOnly(r?.date) || '—';
};

const getSafeStatus = (r) => {
  return normalizeReservationStatus(r?.status);
};

const getSortedReservations = () => {
  const all = getReservations() || [];
  return all
    .slice()
    .sort((a, b) => {
      const da = (a?.date || '').toString();
      const db = (b?.date || '').toString();
      if (da && db && da !== db) return da.localeCompare(db);
      return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
    });
};

const matchesTab = (status, tab) => {
  const statusKey = normalizeReservationStatus(status);
  if (tab === 'need') return statusKey === 'pending';
  if (tab === 'doing') return statusKey === 'preparing';
  if (tab === 'ready') return statusKey === 'ready';
  return true;
};

const filterReservations = (reservations, tab = tabId) => {
  const q = (searchQuery || '').trim().toLowerCase();
  return (reservations || []).filter((r) => {
    const status = getSafeStatus(r);
    if (!matchesTab(status, tab)) return false;
    if (tab === 'all') {
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (dateFilter && (r?.date || '').toString().slice(0, 10) !== dateFilter) return false;
    }
    if (!q) return true;
    const hay = `${r?.id || ''} ${r?.name || ''} ${r?.phone || ''}`.toLowerCase();
    return hay.includes(q);
  });
};

const ensureSelected = (all, filtered) => {
  if (selectedResId && (all || []).some((r) => r.id === selectedResId)) return;
  if (!(filtered || []).length) {
    selectedResId = null;
    return;
  }
  selectedResId = filtered[0].id;
};

const updateReservationStatus = async (id, nextStatus) => {
  const all = getReservations() || [];
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  const currentStatus = getSafeStatus(all[idx]);
  const allowedNext = getNextReservationAction(currentStatus)?.nextStatus;
  const canMoveForward = nextStatus === allowedNext;
  const canCancel = nextStatus === 'cancelled' && canCancelReservation(currentStatus);
  if (!canMoveForward && !canCancel) return false;
  try {
    const remoteResult = await updateReservationStatusOnline(id, nextStatus);
    if (remoteResult) return true;
  } catch (error) {
    toast.error(error?.message || 'Không thể cập nhật trạng thái online.');
    return false;
  }

  const updated = { ...all[idx], status: nextStatus, updatedAt: new Date().toISOString() };
  if (nextStatus === 'completed' && !updated.staffCreated && !updated.pointsAwarded) {
    const points = calculateOrderPoints(updated.total);
    if (points > 0 && addPoints(updated.userId, points)) {
      updated.pointsEarned = points;
      updated.pointsAwarded = true;
      updated.pointsAwardedAt = new Date().toISOString();
    }
  }
  all[idx] = updated;
  saveReservations(all);
  return true;
};

const renderTabs = (reservations) => {
  const counts = Object.fromEntries(TABS.map((t) => [t.id, filterReservations(reservations, t.id).length]));
  return `
  <div class="staff-tabs" role="tablist" aria-label="Phân loại">
    ${TABS.map((t) => `
      <button class="staff-tab${t.id === tabId ? ' active' : ''}" data-tab="${t.id}" type="button">${t.label} (${counts[t.id] ?? 0})</button>
    `).join('')}
  </div>
`;
};

const getResTotals = (r) => {
  const qty = Number(r?.qty || 1);
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
  const price = Number(r?.price || 0);
  const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;
  const total = Number(r?.total);
  const safeTotal = Number.isFinite(total) && total >= 0 ? total : safePrice * safeQty;
  return { safeQty, safeTotal };
};

const renderListItem = (r) => {
  const { safeQty, safeTotal } = getResTotals(r);
  const isActive = r.id === selectedResId;
  const statusKey = getSafeStatus(r);
  const status = RES_STATUS[statusKey];
  const customerLine = `${(r.name || '').toString() || '—'} | ${(r.phone || '').toString() || '—'}`;
  return `
    <div class="staff-list-item${isActive ? ' active' : ''}" data-select="${r.id}">
      <div class="staff-kv">
        <div style="font-weight:700;font-size:var(--font-size-sm)">${icon('reservation')} ${escapeHtml(r.id)}</div>
        <span class="badge ${status.class}">${status.label}</span>
      </div>
      <div class="staff-muted" style="margin-top:6px">${escapeHtml(formatReservationTimestamp(r))}</div>
      <div style="margin-top:8px;display:flex;justify-content:space-between;gap:var(--space-3);align-items:flex-end">
        <div>
          <div style="font-weight:600;color:var(--color-text)">${icon('user')} ${escapeHtml(customerLine)}</div>
          <div class="staff-muted" style="margin-top:4px">${icon('cart')} ${safeQty} món</div>
        </div>
        <div style="font-weight:700;color:var(--color-primary-800)">${formatPrice(safeTotal)}</div>
      </div>
    </div>
  `;
};

const renderDetail = (r) => {
  if (!r) {
    return `
      <div class="empty-state" style="padding:var(--space-10) 0">
        <div class="empty-state-icon">${icon('reservation', 'Đơn đặt trước')}</div>
        <h3>Chọn 1 đơn để xem</h3>
        <p>Chọn 1 đơn từ danh sách để xem chi tiết.</p>
      </div>
    `;
  }

  const statusKey = getSafeStatus(r);
  const status = RES_STATUS[statusKey];
  const { safeQty, safeTotal } = getResTotals(r);
  const itemName = (r.itemName || '').toString() || (r.type === 'ga-nguyen-con' ? 'Gà nguyên con' : r.type === 'vit-nguyen-con' ? 'Vịt nguyên con' : 'Đặt trước');
  const nextAction = getNextReservationAction(statusKey);

  return `
    <div class="staff-detail-shell">
      <div class="staff-kv" style="padding:var(--space-5);padding-bottom:0;margin-bottom:var(--space-4)">
        <div>
          <div style="font-weight:700;color:var(--color-text);font-size:var(--font-size-base)">${icon('reservation')} ${escapeHtml(r.id)}</div>
          <div class="staff-muted" style="margin-top:4px">Ngày cần: <strong>${escapeHtml(formatDateOnly(r.date) || '—')}</strong></div>
        </div>
        <div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;justify-content:flex-end">
          <span class="badge badge-success" style="font-size:var(--font-size-base);font-weight:600;padding:4px 14px">Đã thanh toán</span>
          <span class="badge ${status.class}" style="font-size:var(--font-size-base);font-weight:600;padding:4px 14px">${status.label}</span>
        </div>
      </div>

      <div class="staff-detail-content">
        <div class="staff-info-grid">
          <div class="staff-info-item">${icon('user')}<span>Khách hàng</span><strong>${escapeHtml((r.name || '').toString() || '—')}</strong></div>
          <div class="staff-info-item">${icon('phone')}<span>Số điện thoại</span><strong>${escapeHtml((r.phone || '').toString() || '—')}</strong></div>
          <div class="staff-info-item">${icon('calendar')}<span>Ngày cần</span><strong>${escapeHtml(formatDateOnly(r.date) || '—')}</strong></div>
          <div class="staff-info-item staff-info-wide">${icon('location')}<span>Địa chỉ</span><strong>${escapeHtml((r.address || 'Đơn đặt trước').toString())}</strong></div>
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
              <tr style="border-bottom:1px solid var(--color-beige-100)">
                <td style="padding:6px 0">${escapeHtml(itemName)}</td>
                <td style="text-align:center">x${safeQty}</td>
                <td style="text-align:right;font-weight:600">${formatPrice(safeTotal)}</td>
              </tr>
            </tbody>
          </table>
          ${r.note ? `<div style="margin-top:8px" class="staff-muted">${icon('note')} Ghi chú: ${escapeHtml(r.note)}</div>` : ''}
          <div style="display:flex;justify-content:space-between;margin-top:10px">
            <div class="staff-muted">Tổng tiền hàng</div>
            <div style="font-weight:600">${formatPrice(safeTotal)}</div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px">
            <div class="staff-muted">Giảm giá</div>
            <div style="font-weight:600">-${formatPrice(0)}</div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px dashed var(--color-border)">
            <div style="font-weight:600">Tổng cộng</div>
            <div class="price" style="font-weight:700">${formatPrice(safeTotal)}</div>
          </div>
          <div class="staff-payment-line">Phương thức thanh toán: ${icon('reservation')} Đặt trước</div>
        </div>

        <div class="staff-actions staff-actions--sticky">
          ${nextAction ? `
            <button class="btn btn-primary" data-set-status="${nextAction.nextStatus}" data-confirm="${escapeHtml(nextAction.confirm)}">
              ${escapeHtml(nextAction.label)}
            </button>
          ` : `<span class="staff-muted">Không còn thao tác cập nhật trạng thái.</span>`}
          ${canCancelReservation(statusKey) ? `
            <button class="btn btn-danger" data-set-status="cancelled" data-confirm="Xác nhận huỷ đơn đặt trước?">
              Huỷ đơn
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
};

const renderSelectedReservationDetail = () => {
  const selected = selectedResId ? (getReservations() || []).find((r) => r.id === selectedResId) : null;
  const detailEl = document.getElementById('res-detail');
  if (!detailEl) return;

  detailEl.innerHTML = renderDetail(selected);
  detailEl.querySelectorAll('[data-set-status]')?.forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!selectedResId) return;
      const next = btn.dataset.setStatus;
      const ok = await openStaffConfirm({
        title: 'Xác nhận cập nhật',
        message: btn.dataset.confirm || 'Xác nhận cập nhật trạng thái đơn đặt trước?',
        confirmText: next === 'cancelled' ? 'Huỷ đơn' : 'Xác nhận',
        danger: next === 'cancelled',
      });
      if (!ok) return;
      const updated = await updateReservationStatus(selectedResId, next);
      if (!updated) {
        toast.error('Không thể cập nhật ngược hoặc bỏ qua bước trạng thái.');
        renderPage();
        return;
      }
      toast.success(`Đã cập nhật trạng thái ${selectedResId}.`);
      renderPage();
    });
  });
};

const renderReservationList = (listEl, rows) => {
  if (!listEl) return;

  if (!rows.length) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:var(--space-10) 0">
        <div class="empty-state-icon">${icon('reservation', 'Đơn đặt trước')}</div>
        <h3>Không có đơn đặt trước</h3>
        <p>${searchQuery ? 'Không tìm thấy đơn phù hợp.' : 'Chưa có yêu cầu đặt trước nào.'}</p>
      </div>
    `;
  } else {
    listEl.innerHTML = `<div class="staff-list">${rows.map(renderListItem).join('')}</div>`;
    listEl.querySelectorAll('[data-select]')?.forEach((el) => {
      el.addEventListener('click', () => {
        selectedResId = el.dataset.select;
        listEl.querySelectorAll('[data-select]').forEach((item) => {
          item.classList.toggle('active', item.dataset.select === selectedResId);
        });
        renderSelectedReservationDetail();
      });
    });
  }

  renderSelectedReservationDetail();
};

const openCreatePreorderModal = () => {
  document.getElementById('staff-create-preorder-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'staff-profile-backdrop owner-drawer-backdrop';
  modal.id = 'staff-create-preorder-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <aside class="staff-profile-panel owner-drawer-panel staff-preorder-create-panel">
      <div class="staff-profile-header">
        <div class="staff-profile-title">${icon('reservation')} Tạo preorder</div>
        <button class="modal-close" type="button" data-close aria-label="Đóng">${icon('close')}</button>
      </div>
      <form id="staff-create-preorder-form" novalidate>
        <div class="staff-profile-body">
          <div class="form-group">
            <label class="form-label" for="new-preorder-name">Tên khách</label>
            <input class="form-control" id="new-preorder-name" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="new-preorder-phone">Số điện thoại</label>
            <input class="form-control" id="new-preorder-phone" type="tel" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="new-preorder-item">Món đặt trước</label>
            <select class="form-control" id="new-preorder-item" required>
              ${STAFF_PREORDER_ITEMS.map((item) => `
                <option value="${escapeAttr(item.type)}" data-price="${item.price}" data-name="${escapeAttr(item.itemName)}">
                  ${escapeHtml(item.itemName)} - ${formatPrice(item.price)}
                </option>
              `).join('')}
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
            <div class="form-group">
              <label class="form-label" for="new-preorder-qty">Số lượng</label>
              <input class="form-control" id="new-preorder-qty" type="number" min="1" value="1" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="new-preorder-price">Đơn giá</label>
              <input class="form-control" id="new-preorder-price" type="text" value="${formatPrice(STAFF_PREORDER_ITEMS[0].price)}" readonly>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="new-preorder-date">Ngày pickup</label>
            <input class="form-control" id="new-preorder-date" type="date" value="${escapeAttr(new Date().toISOString().slice(0, 10))}" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="new-preorder-note">Ghi chú</label>
            <textarea class="form-control" id="new-preorder-note" rows="3"></textarea>
          </div>
          <div id="staff-create-preorder-error" class="form-error" style="display:none"></div>
          <div class="staff-actions">
          <button class="btn btn-outline" type="button" data-close>Thoát</button>
          <button class="btn btn-primary" type="submit">Tạo đơn</button>
          </div>
        </div>
      </form>
    </aside>
  `;

  const close = () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => modal.remove(), 180);
  };

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  modal.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  modal.querySelector('#new-preorder-item')?.addEventListener('change', (event) => {
    const option = event.target.selectedOptions?.[0];
    const price = Number(option?.dataset.price || STAFF_PREORDER_ITEMS[0].price);
    const priceInput = modal.querySelector('#new-preorder-price');
    if (priceInput) priceInput.value = formatPrice(price);
  });
  modal.querySelector('#staff-create-preorder-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const err = modal.querySelector('#staff-create-preorder-error');
    const name = modal.querySelector('#new-preorder-name')?.value.trim() || '';
    const phone = modal.querySelector('#new-preorder-phone')?.value.trim() || '';
    const option = modal.querySelector('#new-preorder-item')?.selectedOptions?.[0];
    const type = option?.value || '';
    const itemName = option?.dataset.name || option?.textContent?.trim() || '';
    const qty = Number(modal.querySelector('#new-preorder-qty')?.value || 1);
    const price = Number(option?.dataset.price || 0);
    const date = modal.querySelector('#new-preorder-date')?.value || '';
    if (!name || !phone || !type || !itemName || !date || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
      err.textContent = 'Vui lòng nhập đầy đủ thông tin hợp lệ.';
      err.style.display = 'flex';
      return;
    }
    try {
      const reservation = await createReservationOnline({
        name,
        phone,
        type,
        itemName,
        qty,
        price,
        total: qty * price,
        date,
        note: modal.querySelector('#new-preorder-note')?.value || '',
        staffCreated: true,
        status: 'pending',
      });
      selectedResId = reservation.id;
      toast.success(`Đã tạo preorder ${reservation.id}.`);
      close();
      renderPage();
    } catch (error) {
      err.textContent = error?.message || 'Không thể tạo preorder.';
      err.style.display = 'flex';
    }
  });
  requestAnimationFrame(() => modal.classList.add('active'));
};

const renderPage = () => {
  const all = getSortedReservations();
  const filtered = filterReservations(all);
  ensureSelected(all, filtered);

  const root = document.getElementById('page-content');
  root.classList.add('page-content--staff');
  root.innerHTML = renderStaffShell({
    active: 'preorder',
    pageTitle: '',
    pageSubtitle: '',
    contentHtml: `
      <div class="staff-grid staff-grid--manage">
        <section class="staff-panel" aria-label="Danh sách đơn đặt trước">
          <div class="staff-panel-header">
            <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap">
              ${renderTabs(all)}
              ${tabId === 'all' ? `
                <select class="form-control" id="res-status-filter" aria-label="Lọc trạng thái" style="max-width:220px">
                  <option value="all">Mọi trạng thái</option>
                  ${Object.entries(RES_STATUS).map(([id, meta]) => `<option value="${id}"${statusFilter === id ? ' selected' : ''}>${meta.label}</option>`).join('')}
                </select>
                <input class="form-control" id="res-date-filter" type="date" aria-label="Lọc ngày pickup" value="${dateFilter}" style="max-width:180px">
              ` : ''}
              <div class="search-bar" style="max-width:420px;min-width:260px">
                <span class="search-icon" aria-hidden="true">${icon('search')}</span>
                <input type="search" id="res-search" placeholder="Tìm mã RES / tên / SĐT" aria-label="Tìm đơn đặt trước" value="${(searchQuery || '').replaceAll('"', '&quot;')}">
              </div>
            </div>
          </div>
          <div class="staff-panel-body" style="padding:var(--space-4)" id="res-list"></div>
        </section>

        <section class="staff-panel" aria-label="Chi tiết đơn đặt trước">
          <div class="staff-panel-header">
            <div class="staff-panel-title">${icon('reservation')} Chi tiết</div>
            <button class="btn btn-primary btn-sm" id="create-preorder" type="button">${icon('pen')} Tạo mới</button>
          </div>
          <div class="staff-panel-body" id="res-detail"></div>
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

  const listEl = document.getElementById('res-list');
  renderReservationList(listEl, filtered);

  document.querySelectorAll('[data-tab]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabId = btn.dataset.tab;
      renderPage();
    });
  });

  document.getElementById('res-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    const nextFiltered = filterReservations(all);
    ensureSelected(all, nextFiltered);
    renderReservationList(listEl, nextFiltered);
  });

  document.getElementById('res-status-filter')?.addEventListener('change', (e) => {
    statusFilter = e.target.value || 'all';
    renderPage();
  });

  document.getElementById('res-date-filter')?.addEventListener('change', (e) => {
    dateFilter = e.target.value || '';
    renderPage();
  });

  document.getElementById('create-preorder')?.addEventListener('click', openCreatePreorderModal);
};

document.addEventListener('DOMContentLoaded', async () => {
  requireStaff('admin.html');
  renderPage();
  hydrateOnlineData().then(() => renderPage()).catch(() => {});
  startOnlineRealtime(renderPage);
});
