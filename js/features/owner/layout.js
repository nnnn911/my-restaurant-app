import { getCurrentOwner } from './auth.js';
import { icon } from '../../ui/icons.js';
import { openStaffConfirm } from '../../ui/confirm.js';
import { escapeHtml } from '../../core/html.js';

const getInitials = (name) => {
  const n = (name || '').toString().trim();
  if (!n) return 'CH';
  return n.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
};

export const renderOwnerShell = ({ active = 'dashboard', contentHtml = '' } = {}) => {
  const owner = getCurrentOwner();
  const ownerName = owner?.name || 'Chủ cửa hàng';
  const initials = getInitials(ownerName);

  const navItem = (id, label, href, iconName) => `
    <a class="staff-nav-item${active === id ? ' active' : ''}" data-nav="${id}" href="${href}" aria-label="${escapeHtml(label)}">
      <span class="staff-nav-icon" aria-hidden="true">${icon(iconName)}</span>
      <span class="staff-nav-label">${escapeHtml(label)}</span>
    </a>
  `;

  return `
    <div class="staff-app">
      <aside class="staff-sidebar" aria-label="Thanh điều hướng chủ cửa hàng">
        <div class="staff-sidebar-header">
          <div class="staff-brand">
            <img class="staff-brand-icon" src="assets/logos/logo-green.svg" alt="" aria-hidden="true">
            <div>
              <div class="staff-brand-title">Đồng Quê</div>
              <div class="staff-brand-sub">Owner Console</div>
            </div>
          </div>

          <button class="staff-user" id="owner-open-profile" type="button" aria-label="User Profile">
            <div class="staff-user-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
            <div class="staff-user-meta">
              <div class="staff-user-name">${escapeHtml(ownerName)}</div>
              <div class="staff-user-role">Chủ cửa hàng</div>
            </div>
          </button>
        </div>

        <nav class="staff-nav" aria-label="Menu">
          ${navItem('dashboard', 'Trang chủ', 'owner.html', 'star')}
          ${navItem('reports', 'Báo cáo', 'owner-reports.html', 'stats')}
          ${active === 'reports' ? '<div class="owner-report-tabs owner-report-tabs--nav" id="owner-report-tabs-nav" role="tablist" aria-label="Bộ lọc báo cáo"></div>' : ''}
          ${navItem('menu', 'Quản lý thực đơn', 'owner-menu.html', 'menu')}
          ${navItem('vouchers', 'Quản lý voucher', 'owner-vouchers.html', 'voucher')}
          ${navItem('customers', 'Quản lý khách hàng', 'owner-customers.html', 'user')}
        </nav>
      </aside>

      <main class="staff-main" role="main">
        <div class="staff-content">${contentHtml}</div>
      </main>
    </div>
  `;
};

export const openOwnerProfileModal = ({ onLogout } = {}) => {
  const owner = getCurrentOwner();
  if (!owner) return;

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
        <button class="modal-close" id="owner-profile-close" aria-label="Đóng">✕</button>
      </div>
      <div class="staff-profile-body">
        <div style="display:flex;align-items:center;gap:var(--space-4)">
          <div class="staff-user-avatar" style="width:56px;height:56px;font-size:1.1rem" aria-hidden="true">${escapeHtml(getInitials(owner?.name || 'Chủ cửa hàng'))}</div>
          <div style="min-width:0">
            <div style="font-weight:600;color:var(--color-text)">${escapeHtml(owner?.name || 'Chủ cửa hàng')}</div>
            <div style="color:var(--color-text-muted);font-size:var(--font-size-sm)">${escapeHtml(owner?.phone || '')}</div>
          </div>
          <div style="margin-left:auto">
            <span class="badge badge-muted">${escapeHtml(owner?.id || 'A00000')}</span>
          </div>
        </div>
        <div class="staff-profile-info">
          <div>
            <div class="staff-profile-label">Phiên đăng nhập</div>
            <div class="staff-profile-value">${escapeHtml(owner?.loggedInAt ? new Date(owner.loggedInAt).toLocaleString('vi-VN') : '—')}</div>
          </div>
        </div>
        <div class="staff-profile-actions">
          <button class="btn btn-danger" id="owner-profile-logout" type="button">Đăng xuất</button>
          <button class="btn btn-outline" id="owner-profile-cancel" type="button">Đóng</button>
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
  document.getElementById('owner-profile-close')?.addEventListener('click', close);
  document.getElementById('owner-profile-cancel')?.addEventListener('click', close);
  document.getElementById('owner-profile-logout')?.addEventListener('click', async () => {
    const ok = await openStaffConfirm({
      title: 'Đăng xuất',
      message: 'Bạn có chắc muốn đăng xuất khỏi khu vực chủ cửa hàng?',
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

export const bindOwnerChrome = ({ onLogout } = {}) => {
  document.getElementById('owner-open-profile')?.addEventListener('click', () => openOwnerProfileModal({ onLogout }));
};
