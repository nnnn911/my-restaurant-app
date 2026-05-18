/**
 * staffLayout.js - Shared desktop POS layout for staff pages
 */

import { getCurrentStaff } from './auth.js';
import { icon } from '../../ui/icons.js';
import { openStaffConfirm } from '../../ui/confirm.js';
import { escapeHtml } from '../../core/html.js';
import { observeSearchClears } from '../../ui/searchClear.js';

const getInitials = (name) => {
  const n = (name || '').toString().trim();
  if (!n) return 'NV';
  const parts = n.split(/\s+/).filter(Boolean);
  return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();
};

export const renderStaffShell = ({
  active = 'pos',
  pageTitle = '',
  pageSubtitle = '',
  contentHtml = '',
} = {}) => {
  const staff = getCurrentStaff();
  const staffName = staff?.name || 'Nhân viên';
  const initials = getInitials(staffName);

  const navItem = (id, label, href, icon) => {
    const isActive = active === id;
    return `
      <a class="staff-nav-item${isActive ? ' active' : ''}" data-nav="${id}" href="${href}" aria-label="${escapeHtml(label)}">
        <span class="staff-nav-icon" aria-hidden="true">${icon}</span>
        <span class="staff-nav-label">${escapeHtml(label)}</span>
      </a>
    `;
  };

  return `
    <div class="staff-app">
      <aside class="staff-sidebar" aria-label="Thanh điều hướng nhân viên">
        <div class="staff-sidebar-header">
          <div class="staff-brand">
            <img class="staff-brand-icon" src="assets/logos/logo-green.svg" alt="" aria-hidden="true">
            <div>
              <div class="staff-brand-title">Đồng Quê</div>
              <div class="staff-brand-sub">Staff</div>
            </div>
          </div>

          <button class="staff-user" id="staff-open-profile" type="button" aria-label="User Profile">
            <div class="staff-user-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
            <div class="staff-user-meta">
              <div class="staff-user-name">${escapeHtml(staffName)}</div>
              <div class="staff-user-role">Nhân viên</div>
            </div>
          </button>
        </div>

        <nav class="staff-nav" aria-label="Menu">
          ${navItem('pos', 'POS', 'admin.html', icon('pos'))}
          ${navItem('order', 'Đơn hàng', 'admin-order.html', icon('order'))}
          ${navItem('posOrders', 'Đơn tại quán', 'admin-pos-orders.html', icon('pos'))}
          ${navItem('preorder', 'Đơn Đặt trước', 'admin-preorder.html', icon('reservation'))}
        </nav>

      </aside>

      <main class="staff-main" role="main">
        <div class="staff-content">${contentHtml}</div>
      </main>
    </div>
  `;
};

export const openStaffProfileModal = ({ onLogout } = {}) => {
  const staff = getCurrentStaff();
  if (!staff) return;

  document.getElementById('staff-profile-drawer')?.remove();

  const drawer = document.createElement('div');
  drawer.className = 'staff-profile-backdrop';
  drawer.id = 'staff-profile-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'User Profile');

  drawer.innerHTML = `
    <aside class="staff-profile-panel">
      <div class="staff-profile-header">
        <div class="staff-profile-title">${icon('user')} User Profile</div>
        <button class="modal-close" id="staff-profile-close" aria-label="Đóng">${icon('close')}</button>
      </div>
      <div class="staff-profile-body">
        <div style="display:flex;align-items:center;gap:var(--space-4)">
          <div class="staff-user-avatar" style="width:56px;height:56px;font-size:1.1rem" aria-hidden="true">${escapeHtml(getInitials(staff?.name || 'Nhân viên'))}</div>
          <div style="min-width:0">
            <div style="font-weight:600;color:var(--color-text)">${escapeHtml(staff?.name || 'Nhân viên')}</div>
            <div style="color:var(--color-text-muted);font-size:var(--font-size-sm)">${escapeHtml(staff?.phone || '')}</div>
          </div>
          <div style="margin-left:auto">
            <span class="badge badge-muted">${escapeHtml(staff?.id || 'NV00001')}</span>
          </div>
        </div>

        <div class="staff-profile-info">
          <div>
            <div class="staff-profile-label">Phiên đăng nhập</div>
            <div class="staff-profile-value">${escapeHtml(staff?.loggedInAt ? new Date(staff.loggedInAt).toLocaleString('vi-VN') : '—')}</div>
          </div>
        </div>

        <div class="staff-profile-actions">
          <button class="btn btn-danger" id="staff-profile-logout" type="button">Đăng xuất</button>
          <button class="btn btn-outline" id="staff-profile-cancel" type="button">Đóng</button>
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

  document.getElementById('staff-profile-close')?.addEventListener('click', close);
  document.getElementById('staff-profile-cancel')?.addEventListener('click', close);
  document.getElementById('staff-profile-logout')?.addEventListener('click', async () => {
    const ok = await openStaffConfirm({
      title: 'Đăng xuất',
      message: 'Bạn có chắc muốn đăng xuất khỏi khu vực nhân viên?',
      confirmText: 'Đăng xuất',
      danger: true,
      side: 'left',
    });
    if (ok && typeof onLogout === 'function') {
      close();
      onLogout();
    }
  });

  requestAnimationFrame(() => drawer.classList.add('active'));
};

export const bindStaffChrome = ({ onLogout } = {}) => {
  document.getElementById('staff-open-profile')?.addEventListener('click', () => openStaffProfileModal({ onLogout }));
  observeSearchClears();
};
