/**
 * rewards.js - Customer points & voucher page
 */
import {
  getCurrentUser, getVouchers, getCurrentUserVouchers, redeemPointsForVoucher, validateVoucher, formatPrice,
} from '../../data/store.js';
import { toast } from '../../ui/toast.js';
import { updateNavbarUser } from '../../ui/navbar.js';
import { icon } from '../../ui/icons.js';
import { escapeHtml } from '../../core/html.js';

const voucherValueLabel = (voucher = {}) =>
  voucher.type === 'percent' ? `${Number(voucher.value || 0)}%` : formatPrice(Number(voucher.value || 0));

const formatVoucherDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value.toString()
    : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const voucherMetaLines = (voucher = {}) => {
  const minOrder = Number(voucher.minOrder || 0);
  const expires = voucher.expiresAt ? `HSD ${escapeHtml(formatVoucherDateTime(voucher.expiresAt))}` : 'Không giới hạn hạn dùng';
  return [
    minOrder > 0 ? `Đơn từ ${formatPrice(minOrder)}` : 'Không yêu cầu đơn tối thiểu',
    expires,
  ];
};

const isVoucherUsable = (voucher = {}) => {
  if (!voucher.active) return false;
  return validateVoucher(voucher.code, Math.max(Number(voucher.minOrder || 0), 1)).ok;
};

const renderVoucherList = (vouchers = [], emptyText = 'Chưa có voucher phù hợp') => (
  vouchers.length ? vouchers.map((voucher) => `
    <article class="reward-voucher-card ${voucher.source === 'rewards' ? 'owned' : ''}">
      <div class="reward-voucher-main">
        <div class="reward-voucher-code">${escapeHtml(voucher.code)}</div>
        <div class="reward-voucher-desc">${escapeHtml(voucher.desc || 'Voucher ưu đãi')}</div>
        <div class="reward-voucher-meta">
          ${voucherMetaLines(voucher).map((line) => `<span>${line}</span>`).join('')}
        </div>
      </div>
      <div class="reward-voucher-value">${voucherValueLabel(voucher)}</div>
    </article>
  `).join('') : `<div class="empty-state compact"><h3>${escapeHtml(emptyText)}</h3></div>`
);

export const showRedeemVoucherModal = ({ onRedeemed } = {}) => {
  const user = getCurrentUser();
  if (!user) {
    toast.info('Vui lòng đăng nhập để đổi voucher.');
    return;
  }

  document.getElementById('redeem-voucher-modal')?.remove();
  const maxValue = Number(user.points || 0) * 1000;
  const suggestedValue = maxValue >= 1000 ? Math.min(maxValue, 10000) : 1000;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';
  modal.id = 'redeem-voucher-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Đổi voucher');

  modal.innerHTML = `
    <div class="modal" style="max-width:440px">
      <div class="modal-header">
        <span class="modal-title">${icon('voucher')} Đổi voucher</span>
        <button class="modal-close" id="redeem-close" aria-label="Đóng">✕</button>
      </div>
      <div class="modal-body">
        <div class="redeem-summary">
          <div>
            <div class="redeem-label">Điểm hiện có</div>
            <strong>${Number(user.points || 0).toLocaleString('vi-VN')} điểm</strong>
          </div>
          <div>
            <div class="redeem-label">Quy đổi tối đa</div>
            <strong>${formatPrice(maxValue)}</strong>
          </div>
        </div>
        <form id="redeem-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="redeem-amount">Mệnh giá voucher</label>
            <input class="form-control" id="redeem-amount" type="number" min="1000" step="1000" value="${suggestedValue}" placeholder="VD: 10000">
            <div class="form-hint">Tỉ giá 1 điểm = 1.000đ. Mệnh giá phải là bội số của 1.000đ.</div>
          </div>
          <div id="redeem-error" class="form-error" style="display:none;margin-bottom:var(--space-3)"></div>
          <button class="btn btn-primary btn-block" type="submit">Đổi voucher</button>
        </form>
        <div id="redeem-result" class="redeem-result" style="display:none"></div>
      </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  const close = () => {
    modal.remove();
    document.body.style.overflow = '';
  };

  modal.querySelector('#redeem-close')?.addEventListener('click', close);
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });

  modal.querySelector('#redeem-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const error = modal.querySelector('#redeem-error');
    const resultBox = modal.querySelector('#redeem-result');
    const amount = Number(modal.querySelector('#redeem-amount')?.value || 0);
    const result = redeemPointsForVoucher(amount);
    if (!result.ok) {
      error.textContent = result.msg;
      error.style.display = 'flex';
      resultBox.style.display = 'none';
      return;
    }

    error.style.display = 'none';
    updateNavbarUser();
    toast.success('Đổi voucher thành công.');
    resultBox.innerHTML = `
      <div class="redeem-result-label">Mã voucher mới</div>
      <div class="redeem-result-code">${escapeHtml(result.voucher.code)}</div>
      <div class="redeem-result-note">Giảm ${formatPrice(result.voucher.value)}. Hãy giữ mã này để áp dụng khi thanh toán.</div>
    `;
    resultBox.style.display = 'block';
    modal.querySelector('#redeem-form').style.display = 'none';
    if (typeof onRedeemed === 'function') onRedeemed(result.voucher);
  });
};

export const renderRewardsPage = () => {
  document.getElementById('rewards-page')?.remove();

  const user = getCurrentUser();
  const points = Number(user?.points || 0);
  const valueInVND = points * 1000;
  const allApplicable = getVouchers().filter(isVoucherUsable);
  const ownedVouchers = getCurrentUserVouchers().filter((voucher) => voucher.active);
  const visibleVouchers = [...ownedVouchers, ...allApplicable]
    .filter((voucher, index, vouchers) => (
      vouchers.findIndex((item) => item.code === voucher.code) === index
    ));

  const section = document.createElement('section');
  section.id = 'rewards-page';
  section.className = 'rewards-section';
  section.setAttribute('aria-label', 'Điểm và voucher');

  section.innerHTML = `
    <div class="container">
      <div class="rewards-layout">
        <div class="rewards-header">
          <div>
            <h1>${icon('star')} Điểm & Voucher</h1>
            <p>Tích điểm từ đơn hàng và đổi thành voucher giảm giá.</p>
          </div>
          <button class="btn btn-primary rewards-header-action" data-redeem-voucher type="button" ${!user ? 'disabled' : ''}>${icon('voucher')} Đổi voucher</button>
        </div>

        ${!user ? `
          <div class="form-error rewards-login-warning">Vui lòng đăng nhập để xem điểm và voucher của bạn.</div>
        ` : ''}

        <div class="rewards-grid">
          <div class="points-card rewards-points-card">
            <div class="points-label">Điểm tích lũy hiện tại</div>
            <div><span class="points-value">${points.toLocaleString('vi-VN')}</span><span class="points-unit">điểm</span></div>
            <div class="points-earn">Tương đương ${formatPrice(valueInVND)}</div>
          </div>
          <div class="rewards-info">
            <div class="rewards-info-title">Cách tích và đổi điểm</div>
            <ul>
              <li>Đặt hàng trực tuyến: tích 1 điểm mỗi 10.000đ sau khi đơn hoàn thành.</li>
              <li>Đổi voucher linh hoạt theo tỉ giá 1 điểm = 1.000đ.</li>
            </ul>
          </div>
          <button class="btn btn-primary rewards-mobile-action" data-redeem-voucher type="button" ${!user ? 'disabled' : ''}>${icon('voucher')} Đổi voucher</button>
        </div>

        <section class="rewards-voucher-section" aria-label="Voucher của bạn">
          <div class="rewards-section-heading">
            <h2>${icon('voucher')} Voucher của bạn</h2>
            <span>${visibleVouchers.length} mã</span>
          </div>
          <div class="reward-voucher-list">${renderVoucherList(visibleVouchers, 'Chưa có voucher phù hợp')}</div>
        </section>
      </div>
    </div>`;

  const page = document.querySelector('.page-content');
  const footer = page?.querySelector('.footer');
  page?.insertBefore(section, footer || null);

  section.querySelectorAll('[data-redeem-voucher]').forEach((button) => button.addEventListener('click', () => {
    showRedeemVoucherModal({ onRedeemed: renderRewardsPage });
  }));
};
