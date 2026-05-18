/**
 * profile.js - User profile modal
 */
import { getCurrentUser, updateUser } from '../../data/store.js';
import { toast } from '../../ui/toast.js';
import { updateNavbarUser } from '../../ui/navbar.js';
import { icon } from '../../ui/icons.js';
import { escapeAttr, escapeHtml } from '../../core/html.js';

export const showProfileModal = () => {
  const user = getCurrentUser();
  if (!user) return;
  document.getElementById('profile-modal')?.remove();

  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';
  modal.id = 'profile-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Thông tin cá nhân');

  modal.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <span class="modal-title">${icon('user')} Thông tin cá nhân</span>
        <button class="modal-close" id="profile-modal-close" aria-label="Đóng">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <div style="text-align:center;margin-bottom:var(--space-6)">
          <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--color-primary-400),var(--color-primary-600));display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:700;color:white;margin:0 auto var(--space-3);box-shadow:var(--shadow-primary)">
            ${escapeHtml(initials)}
          </div>
          <div style="font-weight:700;font-size:var(--font-size-lg)">${escapeHtml(user.name)}</div>
          <div style="font-size:var(--font-size-sm);color:var(--color-text-muted)">${escapeHtml(user.phone || '')}</div>
          <div style="display:inline-flex;align-items:center;gap:4px;margin-top:var(--space-2);padding:4px 12px;background:var(--color-accent-100);border-radius:var(--radius-full);font-size:var(--font-size-xs);font-weight:700;color:var(--color-accent-500)">
            ${icon('star')} ${user.points || 0} điểm tích lũy
          </div>
        </div>
        <!-- Edit form -->
        <form id="profile-form" novalidate>
          <div class="reservation-grid">
            <div class="form-group">
              <label class="form-label" for="pf-name">Họ và tên</label>
              <input class="form-control" type="text" id="pf-name" value="${escapeAttr(user.name)}" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="pf-phone">Số điện thoại</label>
              <input class="form-control" type="tel" id="pf-phone" value="${escapeAttr(user.phone || '')}" required>
            </div>
          </div>
          <div id="profile-error" class="form-error" style="display:none;margin-bottom:var(--space-3)"></div>
          <button type="submit" class="btn btn-primary btn-block">Lưu thay đổi</button>
        </form>
      </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  modal.querySelector('#profile-modal-close').addEventListener('click', () => { modal.remove(); document.body.style.overflow = ''; });
  modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; } });

  modal.querySelector('#profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const errEl = modal.querySelector('#profile-error');
    const name = document.getElementById('pf-name').value.trim();
    const phone = document.getElementById('pf-phone').value.trim();

    if (!name) { errEl.innerHTML = `${icon('warning')} Tên không được để trống.`; errEl.style.display = 'flex'; return; }
    if (!phone) { errEl.innerHTML = `${icon('warning')} Số điện thoại không được để trống.`; errEl.style.display = 'flex'; return; }
    if (!/^(0|\+84)[0-9]{8,10}$/.test(phone.replace(/\s+/g, ''))) { errEl.innerHTML = `${icon('warning')} Số điện thoại không hợp lệ.`; errEl.style.display = 'flex'; return; }
    errEl.style.display = 'none';

    const updates = { name, phone };
    const result = updateUser(updates);
    if (!result?.ok) {
      errEl.innerHTML = `${icon('warning')} ${result?.msg || 'Không thể cập nhật thông tin.'}`;
      errEl.style.display = 'flex';
      return;
    }
    updateNavbarUser();
    toast.success('Cập nhật thông tin thành công!');
    modal.remove();
    document.body.style.overflow = '';
  });
};

export const showPointsModal = () => {
  window.location.href = 'rewards.html';
};
