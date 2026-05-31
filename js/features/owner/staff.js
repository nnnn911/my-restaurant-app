import {
  OWNER_SHEET_PAGE_SIZE,
  formatDate,
  getJoinedDuration,
  getPagedRows,
  getSortState,
  icon,
  nextSort,
  openOwnerDrawer,
  openStaffConfirm,
  ownerPaginationTableFooterHtml,
  rerenderOwnerPage,
  scheduleRenderPage,
  sheetSortButton,
  escapeAttr,
  escapeHtml,
} from './common.js';
import { deleteStaffActor, getStaffActors, saveStaffActor } from './staffData.js';
import { toast } from '../../ui/toast.js';

const ROLE_LABELS = {
  staff: 'Nhân viên',
  shipper: 'Shipper',
};

let staffActors = [];
let staffLoaded = false;
let staffLoading = false;
let staffError = '';
let staffSearch = '';
let staffRoleFilter = 'all';
let staffSort = 'id-asc';
let staffSheetPage = 1;

const normalizePhone = (phone = '') => phone.toString().trim().replace(/\s+/g, '');
const formatSalary = (value) => `${Math.max(0, Number(value || 0)).toLocaleString('vi-VN')} VND`;

const roleBadge = (role) => `<span class="badge ${role === 'shipper' ? 'badge-warning' : 'badge-success'}">${escapeHtml(ROLE_LABELS[role] || role)}</span>`;

const loadStaffActors = async () => {
  if (staffLoaded || staffLoading) return;
  staffLoading = true;
  staffError = '';
  try {
    staffActors = await getStaffActors();
    staffLoaded = true;
  } catch (error) {
    staffError = error?.message || 'Không thể tải danh sách nhân viên.';
  } finally {
    staffLoading = false;
  }
};

const refreshStaffActors = async () => {
  staffLoaded = false;
  await loadStaffActors();
};

const getFilteredActors = () => {
  const q = staffSearch.trim().toLowerCase();
  return [...staffActors]
    .filter((actor) => staffRoleFilter === 'all' || actor.role === staffRoleFilter)
    .filter((actor) => `${actor.id} ${actor.name} ${actor.phone} ${actor.salaryVnd} ${ROLE_LABELS[actor.role] || actor.role} ${actor.createdAt}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const { key, dir } = getSortState(staffSort, 'id');
      const direction = dir === 'desc' ? -1 : 1;
      if (key === 'name') return (a.name || '').localeCompare(b.name || '', 'vi') * direction;
      if (key === 'phone') return (a.phone || '').localeCompare(b.phone || '', 'vi', { numeric: true }) * direction;
      if (key === 'salaryVnd') return (Number(a.salaryVnd || 0) - Number(b.salaryVnd || 0)) * direction;
      if (key === 'role') return (a.role || '').localeCompare(b.role || '', 'vi') * direction;
      if (key === 'createdAt' || key === 'joined') return (new Date(a.createdAt || 0) - new Date(b.createdAt || 0)) * direction;
      return (a.id || '').localeCompare(b.id || '', 'vi', { numeric: true }) * direction;
    });
};

export const renderStaffPage = () => {
  if (!staffLoaded && !staffLoading) loadStaffActors().then(() => rerenderOwnerPage());
  const filtered = getFilteredActors();
  const paged = getPagedRows(filtered, staffSheetPage, OWNER_SHEET_PAGE_SIZE);
  staffSheetPage = paged.page;

  return `
    <div class="staff-grid staff-grid--manage owner-sheet-grid">
      <section class="staff-panel" aria-label="Danh sách nhân viên">
        <div class="staff-panel-header owner-menu-header">
          <div class="owner-menu-header-row">
            <div class="search-bar owner-sheet-search">
              <span class="search-icon" aria-hidden="true">${icon('search')}</span>
              <input type="search" id="staff-search" placeholder="Tìm nhân viên..." value="${escapeAttr(staffSearch)}">
            </div>
            <select class="form-control" id="staff-role-filter" aria-label="Lọc vai trò">
              <option value="all"${staffRoleFilter === 'all' ? ' selected' : ''}>Tất cả vai trò</option>
              <option value="staff"${staffRoleFilter === 'staff' ? ' selected' : ''}>Nhân viên</option>
              <option value="shipper"${staffRoleFilter === 'shipper' ? ' selected' : ''}>Shipper</option>
            </select>
            <button class="btn btn-primary" id="staff-create" type="button">${icon('addpeople')} Thêm nhân viên</button>
          </div>
        </div>
        <div class="staff-panel-body owner-sheet-body">
          <div class="owner-table-wrap">
            <table class="owner-table owner-spreadsheet">
              <thead>
                <tr>
                  <th>${sheetSortButton('data-staff-sort', staffSort, 'id', 'ID')}</th>
                  <th>${sheetSortButton('data-staff-sort', staffSort, 'name', 'Tên')}</th>
                  <th>${sheetSortButton('data-staff-sort', staffSort, 'phone', 'Số điện thoại')}</th>
                  <th>${sheetSortButton('data-staff-sort', staffSort, 'role', 'Vai trò')}</th>
                  <th>${sheetSortButton('data-staff-sort', staffSort, 'salaryVnd', 'Lương')}</th>
                  <th>${sheetSortButton('data-staff-sort', staffSort, 'createdAt', 'Ngày tạo')}</th>
                  <th>${sheetSortButton('data-staff-sort', staffSort, 'joined', 'Đã tham gia')}</th>
                </tr>
              </thead>
              <tbody>
                ${staffLoading ? `<tr><td colspan="7"><div class="empty-state"><h3>Đang tải...</h3></div></td></tr>` : ''}
                ${staffError ? `<tr><td colspan="7"><div class="empty-state"><h3>Không thể tải dữ liệu</h3><p>${escapeHtml(staffError)}</p></div></td></tr>` : ''}
                ${!staffLoading && !staffError ? paged.rows.map((actor) => `
                  <tr data-staff-id="${escapeAttr(actor.id)}">
                    <td>${escapeHtml(actor.id)}</td>
                    <td>${escapeHtml(actor.name || 'Nhân viên')}</td>
                    <td>${escapeHtml(actor.phone || '')}</td>
                    <td>${roleBadge(actor.role)}</td>
                    <td>${escapeHtml(formatSalary(actor.salaryVnd))}</td>
                    <td>${escapeHtml(actor.createdAt ? formatDate(actor.createdAt) : '-')}</td>
                    <td>${escapeHtml(getJoinedDuration(actor.createdAt).replace('Đã tham gia ', ''))}</td>
                  </tr>
                `).join('') || `<tr><td colspan="7"><div class="empty-state"><h3>Không tìm thấy nhân viên</h3></div></td></tr>` : ''}
              </tbody>
              ${ownerPaginationTableFooterHtml({ total: filtered.length, page: staffSheetPage, pageCount: paged.pageCount, label: 'nhân viên', prevId: 'staff-prev', nextId: 'staff-next', colspan: 7 })}
            </table>
          </div>
        </div>
      </section>
    </div>
  `;
};

const renderStaffForm = (actor = null) => {
  const isEdit = Boolean(actor?.id);
  return `
    <form class="owner-form" id="staff-form" data-id="${escapeAttr(actor?.id || '')}">
      <div class="owner-form-grid">
        <div class="form-group">
          <label class="form-label" for="staff-name">Tên</label>
          <input class="form-control" id="staff-name" value="${escapeAttr(actor?.name || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="staff-phone">Số điện thoại</label>
          <input class="form-control" id="staff-phone" type="tel" value="${escapeAttr(actor?.phone || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="staff-role">Vai trò</label>
          <select class="form-control" id="staff-role">
            <option value="staff"${(actor?.role || 'staff') === 'staff' ? ' selected' : ''}>Nhân viên</option>
            <option value="shipper"${actor?.role === 'shipper' ? ' selected' : ''}>Shipper</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="staff-salary">Lương (VND)</label>
          <input class="form-control" id="staff-salary" type="number" min="0" step="100000" value="${Number(actor?.salaryVnd || 0)}">
        </div>
        <div class="form-group">
          <label class="form-label" for="staff-password">${isEdit ? 'Mật khẩu mới' : 'Mật khẩu'}</label>
          <input class="form-control" id="staff-password" type="password" autocomplete="new-password" ${isEdit ? 'placeholder="Để trống nếu không đổi"' : 'required'}>
        </div>
      </div>
      ${isEdit ? `
        <div class="staff-profile-info" style="margin-top:0;margin-bottom:var(--space-5)">
          <div><div class="staff-profile-label">Mã nhân viên</div><div class="staff-profile-value">${escapeHtml(actor.id)}</div></div>
          <div><div class="staff-profile-label">Ngày tạo</div><div class="staff-profile-value">${escapeHtml(actor.createdAt ? formatDate(actor.createdAt) : '-')}</div></div>
          <div><div class="staff-profile-label">Thời gian tham gia</div><div class="staff-profile-value">${escapeHtml(getJoinedDuration(actor.createdAt))}</div></div>
        </div>
      ` : ''}
      <div class="staff-actions">
        <button class="btn btn-primary" id="staff-save" type="submit">${icon('pen')} ${isEdit ? 'Lưu nhân viên' : 'Tạo nhân viên'}</button>
        ${isEdit ? `<button class="btn btn-danger" id="staff-delete" type="button">${icon('trashcan')} Xoá</button>` : ''}
      </div>
    </form>
  `;
};

const openStaffDrawer = (actor = null) => {
  openOwnerDrawer({
    title: `${icon(actor ? 'pen' : 'addpeople')} ${actor ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên'}`,
    label: actor ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên',
    bodyHtml: renderStaffForm(actor),
    onBind: (close) => bindStaffForm(close, actor),
  });
};

const bindStaffForm = (closeDrawer, actor = null) => {
  document.getElementById('staff-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('staff-save');
    const nextActor = {
      ...(actor || {}),
      name: document.getElementById('staff-name')?.value.trim() || '',
      phone: normalizePhone(document.getElementById('staff-phone')?.value || ''),
      role: document.getElementById('staff-role')?.value || 'staff',
      salaryVnd: Math.max(0, Number(document.getElementById('staff-salary')?.value || 0)),
      password: document.getElementById('staff-password')?.value || '',
    };
    if (!actor && !nextActor.password) {
      toast.error('Vui lòng nhập mật khẩu khi tạo nhân viên.');
      return;
    }
    saveBtn.disabled = true;
    try {
      await saveStaffActor(nextActor);
      await refreshStaffActors();
      toast.success(actor ? 'Đã lưu nhân viên.' : 'Đã tạo nhân viên.');
      closeDrawer?.();
      rerenderOwnerPage();
    } catch (error) {
      toast.error(error?.message || 'Không thể lưu nhân viên.');
      saveBtn.disabled = false;
    }
  });

  document.getElementById('staff-delete')?.addEventListener('click', async () => {
    if (!actor) return;
    const ok = await openStaffConfirm({
      title: 'Xoá nhân viên',
      message: `Xác nhận xoá ${actor.name || actor.id}?`,
      confirmText: 'Xoá',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteStaffActor(actor);
      await refreshStaffActors();
      toast.success('Đã xoá nhân viên.');
      closeDrawer?.();
      rerenderOwnerPage();
    } catch (error) {
      toast.error(error?.message || 'Không thể xoá nhân viên.');
    }
  });
};

export const bindStaffPage = () => {
  document.querySelectorAll('[data-staff-id]')?.forEach((el) => {
    el.addEventListener('click', () => {
      const actor = staffActors.find((item) => item.id === el.dataset.staffId);
      if (actor) openStaffDrawer(actor);
    });
  });
  document.getElementById('staff-create')?.addEventListener('click', () => openStaffDrawer());
  document.getElementById('staff-search')?.addEventListener('input', (e) => {
    staffSearch = e.target.value;
    staffSheetPage = 1;
    scheduleRenderPage();
  });
  document.getElementById('staff-role-filter')?.addEventListener('change', (e) => {
    staffRoleFilter = e.target.value;
    staffSheetPage = 1;
    rerenderOwnerPage();
  });
  document.querySelectorAll('[data-staff-sort]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      staffSort = nextSort(staffSort, btn.dataset.staffSort);
      staffSheetPage = 1;
      rerenderOwnerPage();
    });
  });
  document.getElementById('staff-prev')?.addEventListener('click', () => {
    staffSheetPage = Math.max(1, staffSheetPage - 1);
    rerenderOwnerPage();
  });
  document.getElementById('staff-next')?.addEventListener('click', () => {
    staffSheetPage += 1;
    rerenderOwnerPage();
  });
};
