import {
  CATEGORY_LABELS,
  MENU_STATUS,
  getMenuStatus,
  moneyInput,
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
  formatPrice,
  saveMenu,
  icon,
  openStaffConfirm,
  escapeAttr,
  escapeHtml
} from './common.js';
import { toast } from '../../ui/toast.js';

let menuSelectedId = null;
let voucherSelectedCode = null;
let customerSelectedId = null;
let searchQuery = '';
let menuStatusFilter = 'all';
let menuCategoryFilter = 'all';
let menuSort = 'name-asc';
let menuSheetPage = 1;
let voucherFilter = 'all';
let voucherSort = 'code-asc';
let voucherSheetPage = 1;
let customerSort = 'id-asc';
let customerSheetPage = 1;

const getSelectedMenuItem = () =>
  getOwnerData().menu.find((m) => m.id === menuSelectedId) || null;

export const renderMenuPage = () => {
  const { menu } = getOwnerData();
  const q = searchQuery.trim().toLowerCase();
  const filtered = menu
    .filter((m) => {
      const status = getMenuStatus(m);
      const matchesStatus = menuStatusFilter === 'all' || status === menuStatusFilter;
      const matchesCategory = menuCategoryFilter === 'all' || m.category === menuCategoryFilter;
      return matchesStatus && matchesCategory && `${m.id} ${m.name} ${m.category} ${m.price} ${getMenuStatus(m)} ${m.sold}`.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const { key, dir } = getSortState(menuSort, 'name');
      const direction = dir === 'desc' ? -1 : 1;
      if (key === 'price') return (Number(a.price || 0) - Number(b.price || 0)) * direction;
      if (key === 'sold') return (Number(a.sold || 0) - Number(b.sold || 0)) * direction;
      if (key === 'category') return (CATEGORY_LABELS[a.category] || a.category || '').localeCompare(CATEGORY_LABELS[b.category] || b.category || '', 'vi') * direction;
      if (key === 'status') return getMenuStatus(a).localeCompare(getMenuStatus(b), 'vi') * direction;
      if (key === 'id') return (a.id || '').localeCompare(b.id || '', 'vi', { numeric: true }) * direction;
      return (a.name || '').localeCompare(b.name || '', 'vi') * direction;
    });
  const paged = getPagedRows(filtered, menuSheetPage, OWNER_SHEET_PAGE_SIZE);
  menuSheetPage = paged.page;
  return `
    <div class="staff-grid staff-grid--manage owner-sheet-grid">
      <section class="staff-panel" aria-label="Danh sách món">
        <div class="staff-panel-header owner-menu-header">
          <div class="owner-menu-header-row">
            <div class="search-bar owner-sheet-search">
              <span class="search-icon" aria-hidden="true">${icon('search')}</span>
              <input type="search" id="owner-search" placeholder="Tìm món..." value="${escapeAttr(searchQuery)}">
            </div>
            <select class="form-control" id="menu-category-filter" aria-label="Lọc nhóm món">
              <option value="all"${menuCategoryFilter === 'all' ? ' selected' : ''}>Mọi nhóm món</option>
              ${Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}"${menuCategoryFilter === value ? ' selected' : ''}>${label}</option>`).join('')}
            </select>
            <select class="form-control" id="menu-status-filter" aria-label="Lọc trạng thái">
              <option value="all"${menuStatusFilter === 'all' ? ' selected' : ''}>Mọi trạng thái</option>
              <option value="available"${menuStatusFilter === 'available' ? ' selected' : ''}>Đang bán</option>
              <option value="soldout"${menuStatusFilter === 'soldout' ? ' selected' : ''}>Hết món</option>
              <option value="hidden"${menuStatusFilter === 'hidden' ? ' selected' : ''}>Ẩn</option>
            </select>
            <button class="btn btn-primary btn-sm owner-add-btn" id="menu-new" type="button">+ Thêm món</button>
          </div>
        </div>
        <div class="staff-panel-body owner-sheet-body">
          <div class="owner-table-wrap">
            <table class="owner-table owner-spreadsheet">
              <thead>
                <tr>
                  <th>${sheetSortButton('data-menu-sort', menuSort, 'id', 'Mã món')}</th>
                  <th>${sheetSortButton('data-menu-sort', menuSort, 'name', 'Món')}</th>
                  <th>${sheetSortButton('data-menu-sort', menuSort, 'category', 'Loại')}</th>
                  <th>${sheetSortButton('data-menu-sort', menuSort, 'price', 'Giá')}</th>
                  <th>${sheetSortButton('data-menu-sort', menuSort, 'status', 'Trạng thái')}</th>
                  <th>${sheetSortButton('data-menu-sort', menuSort, 'sold', 'Đã bán')}</th>
                </tr>
              </thead>
              <tbody>
                ${paged.rows.map((item) => `
                  <tr class="${item.id === menuSelectedId ? 'active' : ''}" data-menu-id="${escapeAttr(item.id)}">
                    <td>${escapeHtml(item.id)}</td>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(CATEGORY_LABELS[item.category] || item.category)}</td>
                    <td>${formatPrice(Number(item.price || 0))}</td>
                    <td><span class="badge ${MENU_STATUS[getMenuStatus(item)].className}">${MENU_STATUS[getMenuStatus(item)].label}</span></td>
                    <td>${Number(item.sold || 0)}</td>
                  </tr>
                `).join('') || `<tr><td colspan="6"><div class="empty-state"><h3>Không tìm thấy món</h3></div></td></tr>`}
              </tbody>
              ${ownerPaginationTableFooterHtml({ total: filtered.length, page: menuSheetPage, pageCount: paged.pageCount, label: 'món', prevId: 'menu-prev', nextId: 'menu-next', colspan: 6 })}
            </table>
          </div>
        </div>
      </section>
    </div>
  `;
};

const renderMenuForm = (item) => {
  if (!item) return `<div class="empty-state"><h3>Chọn món để chỉnh sửa</h3><p>Hoặc tạo món mới từ danh sách bên trái.</p></div>`;
  return `
    <form class="owner-form" id="menu-form" data-id="${escapeAttr(item.id)}">
      <div class="owner-form-grid">
        <div class="form-group">
          <label class="form-label" for="menu-name">Tên món</label>
          <input class="form-control" id="menu-name" value="${escapeAttr(item.name)}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="menu-price">Giá</label>
          ${moneyInput('menu-price', item.price, 'required')}
        </div>
        <div class="form-group">
          <label class="form-label" for="menu-category">Loại</label>
          <select class="form-control" id="menu-category">
            ${Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}"${item.category === value ? ' selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="menu-status">Trạng thái:</label>
          <select class="form-control" id="menu-status">
            <option value="available"${getMenuStatus(item) === 'available' ? ' selected' : ''}>Đang bán</option>
            <option value="soldout"${getMenuStatus(item) === 'soldout' ? ' selected' : ''}>Hết món</option>
            <option value="hidden"${getMenuStatus(item) === 'hidden' ? ' selected' : ''}>Ẩn</option>
          </select>
        </div>
        <div class="owner-image-editor owner-form-wide">
          <div class="form-group">
            <label class="form-label" for="menu-img">Ảnh</label>
            <input class="form-control" id="menu-img" value="${escapeAttr(item.img || '')}" placeholder="assets/images/...">
          </div>
          <div class="owner-image-preview">
            <img id="menu-img-preview" src="${escapeAttr(item.img || 'assets/images/placeholder.svg')}" alt="Preview ảnh món" onerror="this.src='assets/images/placeholder.svg'">
          </div>
        </div>
        <div class="form-group owner-form-wide">
          <label class="form-label" for="menu-desc">Mô tả</label>
          <textarea class="form-control" id="menu-desc" rows="4">${escapeHtml(item.desc || '')}</textarea>
        </div>
      </div>
      <div class="staff-actions">
        <button class="btn btn-primary" type="submit">${icon('pen')} Lưu món</button>
        <button class="btn btn-danger" id="menu-delete" type="button">${icon('trashcan')} Xoá</button>
      </div>
    </form>
  `;
};

const bindMenuForm = (closeDrawer) => {
  document.getElementById('menu-img')?.addEventListener('input', (e) => {
    const preview = document.getElementById('menu-img-preview');
    if (preview) preview.src = e.target.value || 'assets/images/placeholder.svg';
  });
  document.getElementById('menu-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = e.currentTarget.dataset.id;
    const menu = getOwnerData().menu;
    const idx = menu.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const name = document.getElementById('menu-name').value.trim();
    const price = Number(document.getElementById('menu-price').value || 0);
    if (!name || !Number.isFinite(price) || price < 0) {
      toast.error('Tên món và giá chưa hợp lệ.');
      return;
    }
    const status = document.getElementById('menu-status').value;
    menu[idx] = {
      ...menu[idx],
      name,
      category: document.getElementById('menu-category').value,
      price,
      desc: document.getElementById('menu-desc').value.trim(),
      img: document.getElementById('menu-img').value.trim(),
      status,
      sold: Number(menu[idx].sold || 0),
    };
    saveMenu(menu);
    invalidateOwnerData();
    toast.success('Đã lưu thực đơn.');
    closeDrawer?.();
    rerenderOwnerPage();
  });
  document.getElementById('menu-delete')?.addEventListener('click', async () => {
    const item = getSelectedMenuItem();
    if (!item) return;
    const ok = await openStaffConfirm({
      title: 'Xoá món',
      message: `Xác nhận xoá ${item.name}?`,
      confirmText: 'Xoá',
      danger: true,
    });
    if (!ok) return;
    saveMenu(getOwnerData().menu.filter((m) => m.id !== item.id));
    invalidateOwnerData();
    menuSelectedId = null;
    toast.success('Đã xoá món.');
    closeDrawer?.();
    rerenderOwnerPage();
  });
};

const openEditMenuDrawer = (id) => {
  menuSelectedId = id;
  const item = getSelectedMenuItem();
  if (!item) return;
  openOwnerDrawer({
    title: `${icon('pen')} Chỉnh sửa món`,
    label: 'Chỉnh sửa món',
    bodyHtml: renderMenuForm(item),
    onBind: (close) => bindMenuForm(close),
  });
};

export const bindMenuPage = () => {
  document.querySelectorAll('[data-menu-id]')?.forEach((el) => {
    el.addEventListener('click', () => {
      openEditMenuDrawer(el.dataset.menuId);
    });
  });
  document.getElementById('owner-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    menuSheetPage = 1;
    scheduleRenderPage();
  });
  document.getElementById('menu-status-filter')?.addEventListener('change', (e) => {
    menuStatusFilter = e.target.value;
    menuSheetPage = 1;
    rerenderOwnerPage();
  });
  document.getElementById('menu-category-filter')?.addEventListener('change', (e) => {
    menuCategoryFilter = e.target.value;
    menuSheetPage = 1;
    rerenderOwnerPage();
  });
  document.querySelectorAll('[data-menu-sort]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      menuSort = nextSort(menuSort, btn.dataset.menuSort);
      menuSheetPage = 1;
      rerenderOwnerPage();
    });
  });
  document.getElementById('menu-prev')?.addEventListener('click', () => {
    menuSheetPage = Math.max(1, menuSheetPage - 1);
    rerenderOwnerPage();
  });
  document.getElementById('menu-next')?.addEventListener('click', () => {
    menuSheetPage += 1;
    rerenderOwnerPage();
  });
  document.getElementById('menu-new')?.addEventListener('click', openCreateMenuDrawer);
};

const openCreateMenuDrawer = () => {
  document.getElementById('owner-create-drawer')?.remove();
  const drawer = document.createElement('div');
  drawer.className = 'staff-profile-backdrop owner-drawer-backdrop';
  drawer.id = 'owner-create-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Tạo món mới');
  drawer.innerHTML = `
    <aside class="staff-profile-panel owner-drawer-panel">
      <div class="staff-profile-header">
        <div class="staff-profile-title">${icon('pos')} Tạo món mới</div>
        <button class="modal-close" id="create-close" aria-label="Đóng">${icon('close')}</button>
      </div>
      <div class="staff-profile-body">
        <form class="owner-form" id="create-menu-form">
          <div class="owner-form-grid">
            <div class="form-group">
              <label class="form-label" for="new-menu-name">Tên món</label>
              <input class="form-control" id="new-menu-name" placeholder="Nhập tên món" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="new-menu-price">Giá</label>
              ${moneyInput('new-menu-price', 0, 'required')}
            </div>
            <div class="form-group">
              <label class="form-label" for="new-menu-category">Loại</label>
              <select class="form-control" id="new-menu-category">
                ${Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="new-menu-status">Trạng thái:</label>
              <select class="form-control" id="new-menu-status">
                <option value="available">Đang bán</option>
                <option value="soldout">Hết món</option>
                <option value="hidden">Ẩn</option>
              </select>
            </div>
            <div class="owner-image-editor owner-form-wide">
              <div class="form-group">
                <label class="form-label" for="new-menu-img">Ảnh</label>
                <input class="form-control" id="new-menu-img" value="assets/images/placeholder.svg">
              </div>
              <div class="owner-image-preview">
                <img id="new-menu-img-preview" src="assets/images/placeholder.svg" alt="Preview ảnh món" onerror="this.src='assets/images/placeholder.svg'">
              </div>
            </div>
            <div class="form-group owner-form-wide">
              <label class="form-label" for="new-menu-desc">Mô tả</label>
              <textarea class="form-control" id="new-menu-desc" rows="4"></textarea>
            </div>
          </div>
          <div class="staff-actions">
            <button class="btn btn-primary" id="create-menu-save" type="submit">Tạo</button>
            <button class="btn btn-outline" id="create-cancel" type="button">Đóng</button>
          </div>
        </form>
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
  document.getElementById('create-close')?.addEventListener('click', close);
  document.getElementById('create-cancel')?.addEventListener('click', close);
  document.getElementById('new-menu-img')?.addEventListener('input', (e) => {
    const preview = document.getElementById('new-menu-img-preview');
    if (preview) preview.src = e.target.value || 'assets/images/placeholder.svg';
  });
  document.getElementById('create-menu-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-menu-name')?.value.trim();
    const price = Number(document.getElementById('new-menu-price')?.value || 0);
    const status = document.getElementById('new-menu-status')?.value || 'available';
    if (!name || !Number.isFinite(price) || price < 0) {
      toast.error('Tên món và giá chưa hợp lệ.');
      return;
    }
    const menu = getOwnerData().menu;
    const nextNum = menu.reduce((max, item) => {
      const n = Number((item.id || '').replace(/\D/g, ''));
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0) + 1;
    const item = {
      id: `m${nextNum}`,
      name,
      category: document.getElementById('new-menu-category')?.value || 'kho',
      price,
      desc: document.getElementById('new-menu-desc')?.value.trim() || '',
      img: document.getElementById('new-menu-img')?.value.trim() || 'assets/images/placeholder.svg',
      status,
      sold: 0,
    };
    saveMenu([...menu, item]);
    invalidateOwnerData();
    menuSelectedId = item.id;
    toast.success('Đã tạo món mới.');
    close();
    rerenderOwnerPage();
  });

  requestAnimationFrame(() => drawer.classList.add('active'));
};
