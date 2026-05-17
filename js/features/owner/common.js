import {
  formatDate,
  formatPrice,
  getMenu,
  getOrders,
  getUsers,
  getVouchers,
  saveMenu,
  saveUsers,
  saveVouchers,
} from '../../data/store.js';
import { icon } from '../../ui/icons.js';
import { openStaffConfirm } from '../../ui/confirm.js';
import { escapeAttr, escapeHtml } from '../../core/html.js';

export const CATEGORY_LABELS = {
  ga: 'Gà',
  vit: 'Vịt',
  com: 'Cơm',
  uong: 'Đồ uống',
};

export const MENU_STATUS = {
  available: { label: 'Đang bán', className: 'badge-success' },
  soldout: { label: 'Hết món', className: 'badge-warning' },
  hidden: { label: 'Ẩn', className: 'badge-muted' },
};

export const getMenuStatus = (item = {}) => {
  const status = (item.status || '').toString();
  if (MENU_STATUS[status]) return status;
  return 'available';
};

export const getVoucherStatus = (voucher = {}) => voucher.active ? 'active' : 'inactive';

export const normalizePhone = (phone = '') => phone.toString().trim().replace(/\s+/g, '');

export const parseDate = (value) => {
  const d = new Date(value || 0);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const getDateOnly = (value) => {
  const d = parseDate(value);
  return d ? d.toISOString().slice(0, 10) : '';
};

export const getJoinedDuration = (createdAt) => {
  const start = parseDate(createdAt);
  if (!start) return 'Chưa rõ thời gian tham gia';
  const end = new Date();
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  let anchor = new Date(start);
  anchor.setMonth(start.getMonth() + months);
  if (anchor > end) {
    months -= 1;
    anchor = new Date(start);
    anchor.setMonth(start.getMonth() + months);
  }
  const days = Math.max(0, Math.floor((end - anchor) / 86400000));
  return `Đã tham gia ${months} tháng, ${days} ngày`;
};

export const toDateTimeLocal = (value) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.toString())) return `${value}T00:00`;
  const d = parseDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const formatDateTimeValue = (value) => {
  if (!value) return '—';
  const d = parseDate(value);
  return d ? d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : value.toString();
};

export const moneyInput = (id, value, attrs = '') => `
  <div class="owner-money-input">
    <input class="form-control" id="${id}" type="number" min="0" step="1000" value="${Number(value || 0)}" ${attrs}>
    <span>VND</span>
  </div>
`;

let ownerDataCache = null;
let ownerRenderPage = null;
export const OWNER_SHEET_PAGE_SIZE = 12;

export const invalidateOwnerData = () => {
  ownerDataCache = null;
};

export const getOwnerData = () => {
  if (!ownerDataCache) {
    ownerDataCache = {
      menu: getMenu(),
      users: getUsers(),
      vouchers: getVouchers(),
    };
  }
  return ownerDataCache;
};

export const openOwnerDrawer = ({ id = 'owner-object-drawer', title, label, bodyHtml, onBind }) => {
  document.getElementById(id)?.remove();
  const drawer = document.createElement('div');
  drawer.className = 'staff-profile-backdrop owner-drawer-backdrop';
  drawer.id = id;
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', label || title);
  drawer.innerHTML = `
    <aside class="staff-profile-panel owner-drawer-panel">
      <div class="staff-profile-header">
        <div class="staff-profile-title">${title}</div>
        <button class="modal-close" data-owner-drawer-close aria-label="Đóng">✕</button>
      </div>
      <div class="staff-profile-body">${bodyHtml}</div>
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
  drawer.querySelectorAll('[data-owner-drawer-close]').forEach((btn) => btn.addEventListener('click', close));
  onBind?.(close, drawer);
  requestAnimationFrame(() => drawer.classList.add('active'));
  return close;
};

export const getSortState = (value = '', fallback = 'id') => {
  const match = /^(.*)-(asc|desc)$/.exec(value);
  return match ? { key: match[1], dir: match[2] } : { key: value || fallback, dir: 'asc' };
};

export const sortMark = (currentSort, key) => {
  const state = getSortState(currentSort, key);
  if (state.key !== key) return '↕';
  return state.dir === 'asc' ? '↑' : '↓';
};

export const nextSort = (currentSort, key) => {
  const state = getSortState(currentSort, key);
  return `${key}-${state.key === key && state.dir === 'asc' ? 'desc' : 'asc'}`;
};

export const sheetSortButton = (attrName, currentSort, key, label) => {
  const active = getSortState(currentSort, key).key === key;
  return `<button class="owner-th-sort${active ? ' active' : ''}" ${attrName}="${key}" type="button">${label} <span>${sortMark(currentSort, key)}</span></button>`;
};

export const getPagedRows = (rows, currentPage, pageSize) => {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, currentPage), pageCount);
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  return {
    page,
    pageCount,
    rows: pageRows,
    pageRows,
  };
};

export const ownerPaginationHtml = ({ total, page, pageCount, label, prevId, nextId }) => `
  <div class="owner-pagination">
    <span>${total.toLocaleString('vi-VN')} ${label}</span>
    <button class="btn btn-outline btn-sm" id="${prevId}" ${page <= 1 ? 'disabled' : ''}>Trước</button>
    <strong>${page}/${pageCount}</strong>
    <button class="btn btn-outline btn-sm" id="${nextId}" ${page >= pageCount ? 'disabled' : ''}>Sau</button>
  </div>
`;

export const ownerPaginationTableFooterHtml = (options) => `
  <tfoot>
    <tr class="owner-pagination-row">
      <td colspan="${options.colspan}">${ownerPaginationHtml(options)}</td>
    </tr>
  </tfoot>
`;

let searchRenderTimer = null;
export const setOwnerRenderPage = (fn) => { ownerRenderPage = fn; };
export const rerenderOwnerPage = () => { if (typeof ownerRenderPage === 'function') ownerRenderPage(); };
export const scheduleRenderPage = () => {
  window.clearTimeout(searchRenderTimer);
  searchRenderTimer = window.setTimeout(rerenderOwnerPage, 180);
};

export { formatDate, formatPrice, getMenu, getOrders, getUsers, getVouchers, saveMenu, saveUsers, saveVouchers, icon, openStaffConfirm, escapeAttr, escapeHtml };
