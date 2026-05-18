/**
 * toast.js - Toast notification module
 */
import { icon } from './icons.js';

let container = null;

const getContainer = () => {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
};

const ICONS = {
  success: 'check',
  danger:  'close',
  warning: 'warning',
  info:    'info',
};

export const showToast = (message, type = 'info', title = '', duration = 3000) => {
  const c = getContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const defaultTitles = { success: 'Thành công', danger: 'Lỗi', warning: 'Cảnh báo', info: 'Thông báo' };
  const toastTitle = title || defaultTitles[type] || 'Thông báo';

  toast.innerHTML = `
    <div class="toast-icon">${icon(ICONS[type] || 'info')}</div>
    <div class="toast-content">
      <div class="toast-title">${toastTitle}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button onclick="this.parentElement.remove()" style="border:none;background:none;cursor:pointer;color:var(--color-text-light);font-size:1rem;padding:0 0 0 8px;align-self:flex-start;">${icon('close')}</button>
  `;

  c.appendChild(toast);
  setTimeout(() => {
    const exitX = document.querySelector('.page-content--staff') ? '-100%' : '100%';
    toast.style.opacity = '0';
    toast.style.transform = `translateX(${exitX})`;
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

export const toast = {
  success: (msg, title) => showToast(msg, 'success', title),
  error:   (msg, title) => showToast(msg, 'danger', title),
  warning: (msg, title) => showToast(msg, 'warning', title),
  info:    (msg, title) => showToast(msg, 'info', title),
};
