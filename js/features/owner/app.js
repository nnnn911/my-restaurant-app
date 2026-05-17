import { toast } from '../../ui/toast.js';
import { icon } from '../../ui/icons.js';
import { ensureOwnerUsers, getCurrentOwner, loginOwner, logoutOwner } from './auth.js';
import { bindOwnerChrome, renderOwnerShell } from './layout.js';
import { invalidateOwnerData, setOwnerRenderPage } from './common.js';
import { renderMenuPage, bindMenuPage } from './menu.js';
import { renderVoucherPage, bindVoucherPage } from './vouchers.js';
import { renderCustomersPage, bindCustomersPage } from './customers.js';
import {
  bindDashboardPage,
  bindReportsPage,
  renderAnalyticsSkeletonPage,
  renderDashboardPage,
  renderReportsPage,
} from './analytics.js';
import { hydrateOnlineData, startOnlineRealtime } from '../../data/store.js';

const PAGE = document.body.dataset.ownerPage || 'menu';

const renderLogin = () => {
  ensureOwnerUsers();
  const root = document.getElementById('page-content');
  root.classList.add('page-content--staff');
  root.innerHTML = `
    <section style="padding:var(--space-16) 0;background:var(--color-bg)">
      <div class="container">
        <div style="text-align:center;margin-bottom:var(--space-10)">
          <h1 class="section-title" style="font-size:var(--font-size-3xl)">${icon('password')} Đăng nhập chủ cửa hàng</h1>
          <p class="section-subtitle" style="margin-top:var(--space-5)">Trang khởi đầu để xem báo cáo và quản lý vận hành.</p>
        </div>
        <div class="card" style="max-width:520px;margin:0 auto">
          <div class="card-body" style="padding:var(--space-8)">
            <form id="owner-login-form" novalidate>
              <div class="form-group">
                <label class="form-label" for="owner-phone">Số điện thoại</label>
                <div class="input-group">
                  <span class="input-icon" aria-hidden="true">${icon('phone')}</span>
                  <input class="form-control" id="owner-phone" type="tel" autocomplete="tel" placeholder="0903333444" required>
                </div>
                <div class="form-hint" style="margin-top:6px">SĐT mặc định: <strong>0903333444</strong></div>
              </div>
              <div class="form-group">
                <label class="form-label" for="owner-password">Mật khẩu</label>
                <div class="input-group">
                  <span class="input-icon" aria-hidden="true">${icon('password')}</span>
                  <input class="form-control" id="owner-password" type="password" autocomplete="current-password" placeholder="123456" required>
                  <span class="input-icon-right" id="toggle-owner-pw" role="button" aria-label="Hiện mật khẩu" title="Hiện mật khẩu">${icon('showpassword')}</span>
                </div>
                <div class="form-hint" style="margin-top:6px">Mật khẩu mặc định: <strong>123456</strong></div>
              </div>
              <div id="owner-login-error" class="form-error" style="display:none;margin-bottom:var(--space-4)"></div>
              <button type="submit" class="btn btn-primary btn-block btn-lg">Đăng nhập</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  `;

  document.getElementById('toggle-owner-pw')?.addEventListener('click', () => {
    const toggle = document.getElementById('toggle-owner-pw');
    const input = document.getElementById('owner-password');
    const isVisible = input.type !== 'password';
    input.type = isVisible ? 'password' : 'text';
    toggle.innerHTML = icon(isVisible ? 'showpassword' : 'hidepassword');
  });

  document.getElementById('owner-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('owner-login-error');
    errEl.style.display = 'none';
    const phone = document.getElementById('owner-phone').value.trim();
    const password = document.getElementById('owner-password').value;
    if (!phone || !password) {
      errEl.textContent = 'Vui lòng nhập đầy đủ thông tin.';
      errEl.style.display = 'flex';
      return;
    }
    const result = await loginOwner(phone, password);
    if (!result.ok) {
      errEl.textContent = result.msg;
      errEl.style.display = 'flex';
      return;
    }
    toast.success('Đăng nhập thành công.');
    renderPage();
  });
};

const getPageHtml = () => {
  if (PAGE === 'dashboard') return renderDashboardPage();
  if (PAGE === 'reports') return renderReportsPage();
  if (PAGE === 'menu' || PAGE === 'inventory') return renderMenuPage();
  if (PAGE === 'vouchers') return renderVoucherPage();
  if (PAGE === 'customers') return renderCustomersPage();
  return renderMenuPage();
};

const bindPage = () => {
  if (PAGE === 'dashboard') bindDashboardPage();
  else if (PAGE === 'reports') bindReportsPage();
  else if (PAGE === 'menu' || PAGE === 'inventory') bindMenuPage();
  else if (PAGE === 'vouchers') bindVoucherPage();
  else if (PAGE === 'customers') bindCustomersPage();
  else bindMenuPage();
};

const getScrollState = (root) => ({
  windowX: window.scrollX,
  windowY: window.scrollY,
  regions: ['.owner-page', '.owner-table-wrap'].flatMap((selector) => (
    [...root.querySelectorAll(selector)].map((el, index) => ({
      selector,
      index,
      left: el.scrollLeft,
      top: el.scrollTop,
    }))
  )),
});

const restoreScrollState = (root, state) => {
  requestAnimationFrame(() => {
    window.scrollTo({ left: state.windowX, top: state.windowY, behavior: 'auto' });
    state.regions.forEach(({ selector, index, left, top }) => {
      const el = root.querySelectorAll(selector)[index];
      if (el) {
        el.scrollLeft = left;
        el.scrollTop = top;
      }
    });
  });
};

const renderPage = () => {
  if (!getCurrentOwner()) {
    renderLogin();
    return;
  }
  invalidateOwnerData();
  const root = document.getElementById('page-content');
  root.classList.add('page-content--staff');
  const content = root.querySelector('.staff-content');
  const scrollState = content ? getScrollState(root) : null;
  const activeEl = document.activeElement;
  const activeState = activeEl?.id && root.contains(activeEl)
    ? {
      id: activeEl.id,
      start: typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null,
      end: typeof activeEl.selectionEnd === 'number' ? activeEl.selectionEnd : null,
    }
    : null;
  if (content) {
    content.innerHTML = getPageHtml();
  } else {
    root.innerHTML = renderOwnerShell({ active: PAGE, contentHtml: getPageHtml() });
    bindOwnerChrome({
      onLogout: () => {
        logoutOwner();
        toast.success('Đã đăng xuất.');
        window.location.href = 'owner-menu.html';
      },
    });
  }
  bindPage();
  if (activeState) {
    const nextActive = document.getElementById(activeState.id);
    nextActive?.focus({ preventScroll: true });
    if (nextActive && activeState.start !== null && typeof nextActive.setSelectionRange === 'function') {
      nextActive.setSelectionRange(activeState.start, activeState.end ?? activeState.start);
    }
  }
  if (scrollState) restoreScrollState(root, scrollState);
};

document.addEventListener('DOMContentLoaded', async () => {
  await hydrateOnlineData();
  setOwnerRenderPage(renderPage);
  renderPage();
  startOnlineRealtime(renderPage);
});
