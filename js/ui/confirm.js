import { escapeHtml } from '../core/html.js';

export const openStaffConfirm = ({
  title = 'Xác nhận thao tác',
  message = 'Bạn có chắc muốn tiếp tục?',
  confirmText = 'Xác nhận',
  cancelText = 'Quay lại',
  danger = false,
  side = 'right',
} = {}) =>
  new Promise((resolve) => {
    document.getElementById('staff-confirm-drawer')?.remove();

    const drawer = document.createElement('div');
    drawer.id = 'staff-confirm-drawer';
    drawer.className = `staff-confirm-backdrop staff-confirm-backdrop--${side === 'left' ? 'left' : 'right'}`;
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', title);
    drawer.innerHTML = `
      <aside class="staff-confirm-panel">
        <div class="staff-confirm-content">
          <div class="staff-confirm-title">${escapeHtml(title)}</div>
          <div class="staff-confirm-message">${escapeHtml(message)}</div>
          <div class="staff-confirm-actions">
            <button class="btn btn-outline" type="button" data-confirm-cancel>${escapeHtml(cancelText)}</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-confirm-ok>${escapeHtml(confirmText)}</button>
          </div>
        </div>
      </aside>
    `;

    const onKeydown = (event) => {
      if (event.key === 'Escape') close(false);
    };

    const close = (value) => {
      document.removeEventListener('keydown', onKeydown);
      drawer.classList.remove('active');
      setTimeout(() => drawer.remove(), 180);
      resolve(value);
    };

    drawer.addEventListener('click', (event) => {
      if (event.target === drawer) close(false);
    });
    drawer.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => close(false));
    drawer.querySelector('[data-confirm-ok]')?.addEventListener('click', () => close(true));
    document.addEventListener('keydown', onKeydown);

    document.body.appendChild(drawer);
    requestAnimationFrame(() => drawer.classList.add('active'));
  });
