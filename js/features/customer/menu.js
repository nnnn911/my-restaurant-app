/**
 * menu.js - Menu display and item detail modal
 */
import { getMenu, formatPrice, getCurrentUser } from '../../data/store.js';
import { addItemToCart } from './cart.js';
import { openAuthModal } from './auth.js';
import { toast } from '../../ui/toast.js';
import { icon } from '../../ui/icons.js';
import { escapeAttr, escapeHtml } from '../../core/html.js';

let currentCategory = 'all';
let searchQuery = '';

const CATEGORY_LABELS = {
  all: 'Tất cả',
  ga: 'Gà', vit: 'Vịt', bun: 'Bún', mien: 'Miến', chao: 'Cháo', kho: 'Món khô',
};

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'ga', label: 'Gà' },
  { id: 'vit', label: 'Vịt' },
  { id: 'bun', label: 'Bún' },
  { id: 'mien', label: 'Miến' },
  { id: 'chao', label: 'Cháo' },
  { id: 'kho', label: 'Món khô' },
];

export const filterMenu = (cat) => {
  currentCategory = cat;
  setActiveFilter(cat);
  renderMenuItems();
};

export const setMenuCategory = (cat) => {
  if (!cat) return;
  const allowed = new Set(FILTERS.map(f => f.id));
  if (!allowed.has(cat)) return;
  filterMenu(cat);
};

export const initMenu = () => {
  renderMenuSection();
  window.addEventListener('menu:updated', () => renderMenuItems());
};

const getFilteredMenu = () => {
  const menu = getMenu();
  return menu.filter(item => {
    if (item.status === 'hidden') return false;
    const matchCat = currentCategory === 'all' || item.category === currentCategory;
    const q = (searchQuery || '').trim().toLowerCase();
    const hay = `${item.name || ''} ${(item.desc || '')}`.toLowerCase();
    const matchSearch = !q || hay.includes(q);
    return matchCat && matchSearch;
  });
};

const renderMenuSection = () => {
  const section = document.getElementById('menu-section');
  if (!section) return;

  const filterButtons = FILTERS.map(f => `
    <button class="menu-filter-btn${f.id === currentCategory ? ' active' : ''}" data-filter="${f.id}" type="button">${f.label}</button>
  `).join('');

  section.innerHTML = `
    <div class="container">
      <div style="margin-bottom:var(--space-6)">
        <h2 class="section-title">Thực Đơn</h2>
        <p class="section-subtitle" style="margin-top:var(--space-5)">Những món ăn đặc sắc từ quán Đồng Quê</p>
      </div>

      <div class="menu-toolbar" aria-label="Tìm kiếm và lọc thực đơn">
        <div class="search-bar menu-search">
          <span class="search-icon" aria-hidden="true">${icon('search')}</span>
          <input type="search" id="menu-search" placeholder="Tìm món ăn..." aria-label="Tìm kiếm món ăn">
        </div>
        <div class="menu-filters" role="tablist" aria-label="Lọc loại món ăn">
          ${filterButtons}
        </div>
      </div>
      <div id="menu-items-grid" class="menu-grid" role="list" aria-label="Danh sách món ăn" style="margin-top:var(--space-6)"></div>
    </div>`;

  document.getElementById('menu-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderMenuItems();
  });

  section.querySelectorAll('[data-filter]')?.forEach(btn => {
    btn.addEventListener('click', () => filterMenu(btn.dataset.filter));
  });

  renderMenuItems();
};

const setActiveFilter = (cat) => {
  document.querySelectorAll('.menu-filter-btn[data-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === cat);
  });
};

export const renderMenuItems = () => {
  const grid = document.getElementById('menu-items-grid');
  if (!grid) return;
  const items = getFilteredMenu();

  if (!items.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🍽️</div>
        <h3>Không tìm thấy món ăn</h3>
        <p>Thử tìm với từ khóa khác hoặc chọn danh mục khác.</p>
      </div>`;
    return;
  }

  grid.innerHTML = items.map((item, i) => `
    <article class="menu-item-card animate-fade-in" 
      role="listitem" 
      data-id="${escapeAttr(item.id)}" 
      style="animation-delay:${i * 0.05}s"
      tabindex="0"
      aria-label="${escapeAttr(`${item.name}, giá ${formatPrice(item.price)}`)}">
      <div class="menu-item-img-wrap">
        <img class="menu-item-img" src="${escapeAttr(item.img)}" alt="${escapeAttr(item.name)}" 
          loading="lazy"
          onerror="this.src='assets/images/placeholder.svg'">
        ${item.status === 'soldout' ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;"><span class="badge badge-muted">Hết món</span></div>` : ''}
      </div>
      <div class="menu-item-body">
        <div class="menu-item-meta">
          <div class="menu-item-cat">${escapeHtml(CATEGORY_LABELS[item.category] || item.category)}</div>
          <div class="menu-item-sold">Đã bán ${Number(item.sold || 0)}</div>
        </div>
        <h3 class="menu-item-name">${escapeHtml(item.name)}</h3>
        <p class="menu-item-desc">${escapeHtml(item.desc)}</p>
        <div class="menu-item-footer">
          <span class="price price-lg">${formatPrice(item.price)}</span>
          <button class="btn btn-primary btn-sm btn-add-cart" 
            data-id="${escapeAttr(item.id)}" 
            aria-label="${escapeAttr(`Thêm ${item.name} vào giỏ hàng`)}"
            ${item.status !== 'available' ? 'disabled' : ''}>
            +
          </button>
        </div>
      </div>
    </article>`).join('');

  // Bind events
  grid.querySelectorAll('.menu-item-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-add-cart')) return;
      openItemDetail(card.dataset.id);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') openItemDetail(card.dataset.id);
    });
  });
  grid.querySelectorAll('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!getCurrentUser()) {
        openAuthModal('login');
        return;
      }
      const item = getMenu().find(m => m.id === btn.dataset.id);
      if (!item) return;
      addItemToCart(item);
      // Button feedback
      btn.textContent = '✓';
      btn.style.background = 'var(--color-success)';
      setTimeout(() => { btn.textContent = '+'; btn.style.background = ''; }, 1200);
    });
  });
};

const openItemDetail = (id) => {
  const item = getMenu().find(m => m.id === id);
  if (!item) return;

  let qty = 1;
  let noteVal = '';

  const existing = document.getElementById('item-detail-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';
  modal.id = 'item-detail-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', item.name || 'Chi tiết món');

  const render = () => {
    modal.innerHTML = `
      <div class="modal" style="max-width:500px">
        <div style="position:relative;padding-top:50%;background:var(--color-beige-100);overflow:hidden;">
          <img src="${escapeAttr(item.img)}" alt="${escapeAttr(item.name)}" onerror="this.src='assets/images/placeholder.svg'"
            style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">
          <button id="detail-close" aria-label="Đóng" style="position:absolute;top:1rem;right:1rem;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.9);border:none;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
        <div class="modal-body">
          <div style="font-size:var(--font-size-xs);font-weight:600;color:var(--color-primary-500);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">${escapeHtml(CATEGORY_LABELS[item.category] || item.category)}</div>
          <h2 style="font-size:var(--font-size-2xl);font-weight:800;color:var(--color-text);margin-bottom:var(--space-2)">${escapeHtml(item.name)}</h2>
          <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);line-height:1.7;margin-bottom:var(--space-5)">${escapeHtml(item.desc)}</p>
          <div style="color:var(--color-text-light);font-size:var(--font-size-xs);font-weight:600;margin-bottom:var(--space-5)">Đã bán ${Number(item.sold || 0)}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-5)">
            <span class="price price-lg" style="font-size:1.5rem">${formatPrice(item.price)}</span>
            <div class="qty-stepper">
              <button class="qty-btn" id="qty-minus" aria-label="Giảm">−</button>
              <span class="qty-value" id="qty-display">${qty}</span>
              <button class="qty-btn" id="qty-plus" aria-label="Tăng">+</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="item-note">Ghi chú (tuỳ chọn)</label>
            <input class="form-control" type="text" id="item-note" placeholder="Ít cay, không hành..." value="${escapeAttr(noteVal)}" maxlength="100">
          </div>
          <div style="display:flex;gap:var(--space-3)">
            <button class="btn btn-outline" id="detail-cancel" style="flex:0 0 auto">Quay lại</button>
            <button class="btn btn-primary btn-block" id="detail-add-cart" ${item.status !== 'available' ? 'disabled' : ''}>
              Thêm vào giỏ - ${formatPrice(item.price * qty)}
            </button>
          </div>
        </div>
      </div>`;

    modal.querySelector('#detail-close')?.addEventListener('click', () => { modal.remove(); document.body.style.overflow = ''; });
    modal.querySelector('#detail-cancel')?.addEventListener('click', () => { modal.remove(); document.body.style.overflow = ''; });
    modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; } });

    modal.querySelector('#qty-minus')?.addEventListener('click', () => { if (qty > 1) { qty--; updateQty(); } });
    modal.querySelector('#qty-plus')?.addEventListener('click', () => { qty++; updateQty(); });
    modal.querySelector('#item-note')?.addEventListener('input', (e) => { noteVal = e.target.value; });

    modal.querySelector('#detail-add-cart')?.addEventListener('click', () => {
      noteVal = modal.querySelector('#item-note')?.value || '';
      if (!getCurrentUser()) {
        modal.remove();
        document.body.style.overflow = '';
        openAuthModal('login');
        return;
      }
      addItemToCart({ ...item, qty, note: noteVal });
      modal.remove();
      document.body.style.overflow = '';
    });
  };

  const updateQty = () => {
    modal.querySelector('#qty-display').textContent = qty;
    modal.querySelector('#detail-add-cart').innerHTML = `${icon('cart')} Thêm vào giỏ — ${formatPrice(item.price * qty)}`;
  };

  render();
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
};
