import {
  normalizePhone,
  getJoinedDuration,
  OWNER_SHEET_PAGE_SIZE,
  invalidateOwnerData,
  getOwnerData,
  openOwnerDrawer,
  getSortState,
  nextSort,
  sheetSortButton,
  getPagedRows,
  ownerPaginationTableFooterHtml,
  scheduleRenderPage,
  rerenderOwnerPage,
  formatDate,
  deleteUserOnline,
  updateUserPointsOnline,
  saveUsers,
  icon,
  openStaffConfirm,
  escapeAttr,
  escapeHtml
} from './common.js';
import { toast } from '../../ui/toast.js';

let searchQuery = '';
let customerSort = 'id-asc';
let customerSheetPage = 1;
let customerSelectedId = null;

const getSelectedCustomer = () => {
  return getOwnerData().users.find((u) => u.id === customerSelectedId) || null;
};

export const renderCustomersPage = () => {
  const { users } = getOwnerData();
  const q = searchQuery.trim().toLowerCase();
  const filtered = users
    .filter((u) => `${u.id} ${u.name} ${u.phone} ${u.points} ${u.createdAt}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const { key, dir } = getSortState(customerSort, 'id');
      const direction = dir === 'desc' ? -1 : 1;
      if (key === 'name') return (a.name || '').localeCompare(b.name || '', 'vi') * direction;
      if (key === 'phone') return (a.phone || '').localeCompare(b.phone || '', 'vi', { numeric: true }) * direction;
      if (key === 'points') return (Number(a.points || 0) - Number(b.points || 0)) * direction;
      if (key === 'createdAt' || key === 'joined') return (new Date(a.createdAt || 0) - new Date(b.createdAt || 0)) * direction;
      return (a.id || '').localeCompare(b.id || '', 'vi', { numeric: true }) * direction;
    });
  const paged = getPagedRows(filtered, customerSheetPage, OWNER_SHEET_PAGE_SIZE);
  customerSheetPage = paged.page;
  return `
    <div class="staff-grid staff-grid--manage owner-sheet-grid">
      <section class="staff-panel" aria-label="Danh sách khách hàng">
        <div class="staff-panel-header owner-menu-header">
          <div class="owner-menu-header-row">
            <div class="search-bar owner-sheet-search">
              <span class="search-icon" aria-hidden="true">${icon('search')}</span>
              <input type="search" id="owner-search" placeholder="Tìm khách hàng..." value="${escapeAttr(searchQuery)}">
            </div>
          </div>
        </div>
        <div class="staff-panel-body owner-sheet-body">
          <div class="owner-table-wrap">
            <table class="owner-table owner-spreadsheet">
              <thead>
                <tr>
                  <th>${sheetSortButton('data-customer-sort', customerSort, 'id', 'ID')}</th>
                  <th>${sheetSortButton('data-customer-sort', customerSort, 'name', 'Tên')}</th>
                  <th>${sheetSortButton('data-customer-sort', customerSort, 'phone', 'Số điện thoại')}</th>
                  <th>${sheetSortButton('data-customer-sort', customerSort, 'points', 'Điểm')}</th>
                  <th>${sheetSortButton('data-customer-sort', customerSort, 'createdAt', 'Ngày tạo')}</th>
                  <th>${sheetSortButton('data-customer-sort', customerSort, 'joined', 'Đã tham gia')}</th>
                </tr>
              </thead>
              <tbody>
                ${paged.rows.map((u) => `
                  <tr class="${u.id === customerSelectedId ? 'active' : ''}" data-customer-id="${escapeAttr(u.id)}">
                    <td>${escapeHtml(u.id)}</td>
                    <td>${escapeHtml(u.name || 'Khách hàng')}</td>
                    <td>${escapeHtml(u.phone || '')}</td>
                    <td>${Number(u.points || 0)}</td>
                    <td>${escapeHtml(u.createdAt ? formatDate(u.createdAt) : '—')}</td>
                    <td>${escapeHtml(getJoinedDuration(u.createdAt).replace('Đã tham gia ', ''))}</td>
                  </tr>
                `).join('') || `<tr><td colspan="6"><div class="empty-state"><h3>Không tìm thấy khách hàng</h3></div></td></tr>`}
              </tbody>
              ${ownerPaginationTableFooterHtml({ total: filtered.length, page: customerSheetPage, pageCount: paged.pageCount, label: 'khách hàng', prevId: 'customer-prev', nextId: 'customer-next', colspan: 6 })}
            </table>
          </div>
        </div>
      </section>
    </div>
  `;
};

const renderCustomerForm = (u) => {
  if (!u) return `<div class="empty-state"><h3>Chọn khách hàng để xem</h3></div>`;
  return `
    <form class="owner-form" id="customer-form" data-id="${escapeAttr(u.id)}">
      <div class="owner-form-grid">
        <div class="form-group">
          <label class="form-label" for="customer-name">Tên</label>
          <input class="form-control" id="customer-name" value="${escapeAttr(u.name || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="customer-phone">Số điện thoại</label>
          <input class="form-control" id="customer-phone" type="tel" value="${escapeAttr(u.phone || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Điểm</label>
          <div class="owner-points-box">
            ${Number(u.points || 0)}
            <button class="btn btn-outline btn-sm" id="customer-points-open" type="button">${icon('pen')} Cập nhật</button>
          </div>
        </div>
      </div>
      <div class="staff-profile-info" style="margin-top:0;margin-bottom:var(--space-5)">
        <div>
          <div class="staff-profile-label">Mã khách hàng</div>
          <div class="staff-profile-value">${escapeHtml(u.id)}</div>
        </div>
        <div>
          <div class="staff-profile-label">Ngày tạo</div>
          <div class="staff-profile-value">${escapeHtml(u.createdAt ? formatDate(u.createdAt) : '—')}</div>
        </div>
        <div>
          <div class="staff-profile-label">Thời gian tham gia</div>
          <div class="staff-profile-value">${escapeHtml(getJoinedDuration(u.createdAt))}</div>
        </div>
      </div>
      <div class="staff-actions">
        <button class="btn btn-primary" type="submit">${icon('pen')} Lưu khách hàng</button>
        <button class="btn btn-danger" id="customer-delete" type="button">${icon('trashcan')} Xoá</button>
      </div>
    </form>
  `;
};

const openCustomerPointsMenu = (user) => {
  if (!user) return;
  document.getElementById('owner-points-drawer')?.remove();
  const drawer = document.createElement('div');
  drawer.className = 'staff-profile-backdrop owner-drawer-backdrop';
  drawer.id = 'owner-points-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Cập nhật điểm khách hàng');
  drawer.innerHTML = `
    <aside class="staff-profile-panel owner-drawer-panel">
      <div class="staff-profile-header">
        <div class="staff-profile-title">${icon('pen')} Cập nhật điểm</div>
        <button class="modal-close" id="points-close" aria-label="Đóng">${icon('close')}</button>
      </div>
      <div class="staff-profile-body">
        <div class="staff-profile-info" style="margin-top:0;padding-top:0;border-top:0">
          <div>
            <div class="staff-profile-label">Khách hàng</div>
            <div class="staff-profile-value">${escapeHtml(user.name || user.id)}</div>
          </div>
          <div>
            <div class="staff-profile-label">Điểm hiện tại</div>
            <div class="staff-profile-value">${Number(user.points || 0)} điểm</div>
          </div>
        </div>
        <div class="form-group" style="margin-top:var(--space-6)">
          <label class="form-label" for="points-mode">Kiểu cập nhật</label>
          <select class="form-control" id="points-mode">
            <option value="add">Cộng điểm</option>
            <option value="subtract">Trừ điểm</option>
            <option value="set">Đặt điểm mới</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="points-value">Số điểm</label>
          <input class="form-control" id="points-value" type="number" min="0" value="0">
        </div>
        <div class="staff-actions">
          <button class="btn btn-primary" id="points-save" type="button">Cập nhật</button>
          <button class="btn btn-outline" id="points-cancel" type="button">Đóng</button>
        </div>
      </div>
    </aside>
  `;
  document.body.appendChild(drawer);
  document.body.style.overflow = 'hidden';

  const close = () => {
    drawer.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => drawer.remove(), 180);
  };

  drawer.addEventListener('click', (e) => {
    if (e.target === drawer) close();
  });
  document.getElementById('points-close')?.addEventListener('click', close);
  document.getElementById('points-cancel')?.addEventListener('click', close);
  document.getElementById('points-save')?.addEventListener('click', async () => {
    const value = Math.max(0, Number(document.getElementById('points-value')?.value || 0));
    const mode = document.getElementById('points-mode')?.value || 'add';
    const users = getOwnerData().users;
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx === -1) return;
    const current = Number(users[idx].points || 0);
    const nextPoints = mode === 'set' ? value : mode === 'subtract' ? Math.max(0, current - value) : current + value;
    const saveBtn = document.getElementById('points-save');
    saveBtn.disabled = true;
    try {
      users[idx] = await updateUserPointsOnline(user.id, nextPoints);
      invalidateOwnerData();
      toast.success('Đã cập nhật điểm khách hàng.');
      close();
      rerenderOwnerPage();
    } catch (error) {
      toast.error(error?.message || 'Không thể cập nhật điểm khách hàng.');
      saveBtn.disabled = false;
    }
  });

  requestAnimationFrame(() => drawer.classList.add('active'));
};

const bindCustomerForm = (closeDrawer) => {
  document.getElementById('customer-points-open')?.addEventListener('click', () => openCustomerPointsMenu(getSelectedCustomer()));
  document.getElementById('customer-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = e.currentTarget.dataset.id;
    const users = getOwnerData().users;
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return;
    const phone = normalizePhone(document.getElementById('customer-phone').value);
    if (!phone || users.some((u) => u.id !== id && normalizePhone(u.phone) === phone)) {
      toast.error('Số điện thoại trống hoặc đã được sử dụng.');
      return;
    }
    users[idx] = {
      ...users[idx],
      name: document.getElementById('customer-name').value.trim(),
      phone,
    };
    saveUsers(users);
    invalidateOwnerData();
    toast.success('Đã lưu khách hàng.');
    closeDrawer?.();
    rerenderOwnerPage();
  });
  document.getElementById('customer-delete')?.addEventListener('click', async () => {
    const u = getSelectedCustomer();
    if (!u) return;
    const ok = await openStaffConfirm({ title: 'Xoá khách hàng', message: `Xác nhận xoá ${u.name || u.id}?`, confirmText: 'Xoá', danger: true });
    if (!ok) return;
    try {
      await deleteUserOnline(u.id);
      invalidateOwnerData();
      customerSelectedId = null;
      toast.success('Đã xoá khách hàng.');
      closeDrawer?.();
      rerenderOwnerPage();
    } catch (error) {
      toast.error(error?.message || 'Không thể xoá khách hàng khỏi database.');
    }
  });
};

const openEditCustomerDrawer = (id) => {
  customerSelectedId = id;
  const customer = getSelectedCustomer();
  if (!customer) return;
  openOwnerDrawer({
    title: `${icon('user')} Chỉnh sửa khách hàng`,
    label: 'Chỉnh sửa khách hàng',
    bodyHtml: renderCustomerForm(customer),
    onBind: (close) => bindCustomerForm(close),
  });
};

export const bindCustomersPage = () => {
  document.querySelectorAll('[data-customer-id]')?.forEach((el) => {
    el.addEventListener('click', () => {
      openEditCustomerDrawer(el.dataset.customerId);
    });
  });
  document.getElementById('owner-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    customerSheetPage = 1;
    scheduleRenderPage();
  });
  document.querySelectorAll('[data-customer-sort]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      customerSort = nextSort(customerSort, btn.dataset.customerSort);
      customerSheetPage = 1;
      rerenderOwnerPage();
    });
  });
  document.getElementById('customer-prev')?.addEventListener('click', () => {
    customerSheetPage = Math.max(1, customerSheetPage - 1);
    rerenderOwnerPage();
  });
  document.getElementById('customer-next')?.addEventListener('click', () => {
    customerSheetPage += 1;
    rerenderOwnerPage();
  });
};
