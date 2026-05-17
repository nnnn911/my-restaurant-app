/**
 * cart.js - Cart sidebar module
 */
import {
  getCart, addToCart, removeFromCart, updateCartQty, updateCartItemNote,
  getCartTotal, getCartCount, clearCart, formatPrice,
  getCurrentUser
} from '../../data/store.js';
import { toast } from '../../ui/toast.js';
import { updateCartBadge } from '../../ui/navbar.js';
import { openAuthModal } from './auth.js';
import { icon } from '../../ui/icons.js';
import { escapeAttr, escapeHtml } from '../../core/html.js';

let sidebarEl = null;
let overlayEl = null;

export const openCart = () => {
  if (!getCurrentUser()) {
    openAuthModal('login');
    toast.info('Vui lòng đăng nhập để xem giỏ hàng.');
    return;
  }
  ensureSidebar();
  sidebarEl.classList.add('open');
  overlayEl.classList.add('active');
  document.body.style.overflow = 'hidden';
  renderCartItems();
};

export const closeCart = () => {
  sidebarEl?.classList.remove('open');
  overlayEl?.classList.remove('active');
  document.body.style.overflow = '';
};

export const addItemToCart = (item) => {
  addToCart(item);
  updateCartBadge();
  toast.success(`Đã thêm "${item.name}" vào giỏ hàng!`);
  // Animate cart btn
  const cartBtn = document.getElementById('cart-btn');
  cartBtn?.classList.add('animate-pulse');
  setTimeout(() => cartBtn?.classList.remove('animate-pulse'), 600);
};

const ensureSidebar = () => {
  if (sidebarEl) return;

  overlayEl = document.createElement('div');
  overlayEl.className = 'overlay';
  overlayEl.id = 'cart-overlay';
  overlayEl.addEventListener('click', closeCart);

  sidebarEl = document.createElement('aside');
  sidebarEl.className = 'cart-sidebar';
  sidebarEl.id = 'cart-sidebar';
  sidebarEl.setAttribute('role', 'complementary');
  sidebarEl.setAttribute('aria-label', 'Giỏ hàng');
  sidebarEl.innerHTML = `
    <div class="cart-header">
      <div class="cart-title">Giỏ hàng <span class="cart-count-badge" id="cart-count-badge">0</span></div>
      <button class="cart-close" id="cart-close-btn" aria-label="Đóng giỏ hàng">✕</button>
    </div>
    <div class="cart-body" id="cart-body"></div>
    <div class="cart-footer" id="cart-footer"></div>`;

  document.body.append(overlayEl, sidebarEl);
  document.getElementById('cart-close-btn').addEventListener('click', closeCart);
};

const renderCartItems = () => {
  const cart = getCart();
  const bodyEl = document.getElementById('cart-body');
  const footerEl = document.getElementById('cart-footer');
  const countBadge = document.getElementById('cart-count-badge');

  if (countBadge) countBadge.textContent = getCartCount();

  if (!cart.length) {
    bodyEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon('cart', 'Giỏ hàng')}</div>
        <h3>Giỏ hàng trống</h3>
        <p>Hãy chọn món ăn yêu thích của bạn nhé!</p>
      </div>`;
    footerEl.innerHTML = '';
    return;
  }

  bodyEl.innerHTML = cart.map(item => `
    <div class="cart-item" data-cart-id="${escapeAttr(item.cartId)}">
      <div class="cart-item-img">
        <img src="${escapeAttr(item.img)}" alt="${escapeAttr(item.name)}" onerror="this.src='assets/images/placeholder.svg'">
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <label class="cart-item-note-label" for="cart-note-${escapeAttr(item.cartId)}">Ghi chú:</label>
        <input class="cart-item-note-input" id="cart-note-${escapeAttr(item.cartId)}" data-id="${escapeAttr(item.cartId)}" type="text" value="${escapeAttr(item.note || '')}" placeholder="Thêm ghi chú cho món..." maxlength="100">
        <div class="cart-item-actions">
          <div class="qty-stepper">
            <button class="qty-btn btn-qty-minus" data-id="${escapeAttr(item.cartId)}" aria-label="Giảm số lượng">−</button>
            <span class="qty-value">${Number(item.qty || 0)}</span>
            <button class="qty-btn btn-qty-plus" data-id="${escapeAttr(item.cartId)}" aria-label="Tăng số lượng">+</button>
          </div>
          <span class="cart-item-price">${formatPrice(item.price * item.qty)}</span>
        </div>
      </div>
      <button class="cart-item-remove" data-id="${escapeAttr(item.cartId)}" aria-label="Xóa món">✕</button>
    </div>`).join('');

  // Bind item events
  bodyEl.querySelectorAll('.btn-qty-minus').forEach(btn =>
    btn.addEventListener('click', () => { updateCartQty(btn.dataset.id, getCart().find(c => c.cartId === btn.dataset.id)?.qty - 1); updateCartBadge(); renderCartItems(); }));
  bodyEl.querySelectorAll('.btn-qty-plus').forEach(btn =>
    btn.addEventListener('click', () => { updateCartQty(btn.dataset.id, getCart().find(c => c.cartId === btn.dataset.id)?.qty + 1); updateCartBadge(); renderCartItems(); }));
  bodyEl.querySelectorAll('.cart-item-remove').forEach(btn =>
    btn.addEventListener('click', () => { removeFromCart(btn.dataset.id); updateCartBadge(); renderCartItems(); }));
  bodyEl.querySelectorAll('.cart-item-note-input').forEach(input => {
    input.addEventListener('change', () => {
      updateCartItemNote(input.dataset.id, input.value);
      updateCartBadge();
      renderCartItems();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') input.blur();
    });
  });

  renderCartFooter(footerEl);
};

const renderCartFooter = (footerEl) => {
  const total = getCartTotal();

  footerEl.innerHTML = `
    <div class="cart-summary">
      <div class="cart-summary-row"><span>Tạm tính</span><span>${formatPrice(total)}</span></div>
      <div class="cart-summary-row"><span>Phí giao hàng</span><span class="text-success">Miễn phí</span></div>
      <div class="cart-summary-row total"><span>Tổng cộng</span><span class="price">${formatPrice(total)}</span></div>
    </div>
    <button class="btn btn-primary btn-block btn-lg" id="btn-checkout" ${!getCartCount() ? 'disabled' : ''}>
      Đặt hàng ngay
    </button>
    `;

  document.getElementById('btn-checkout')?.addEventListener('click', () => {
    if (!getCurrentUser()) { closeCart(); openAuthModal(); toast.info('Vui lòng đăng nhập để đặt hàng.'); return; }
    closeCart();
    window.location.href = 'checkout.html';
  });
};
