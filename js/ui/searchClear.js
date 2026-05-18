import { icon } from './icons.js';

const SEARCH_CLEAR_CLASS = 'search-clear-btn';

const updateClearButton = (input, button) => {
  const hasValue = Boolean((input.value || '').trim());
  button.hidden = !hasValue;
  button.setAttribute('aria-hidden', hasValue ? 'false' : 'true');
};

export const enhanceSearchClears = (root = document) => {
  root.querySelectorAll?.('.search-bar input[type="search"]').forEach((input) => {
    const bar = input.closest('.search-bar');
    if (!bar || bar.querySelector(`.${SEARCH_CLEAR_CLASS}`)) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = SEARCH_CLEAR_CLASS;
    button.setAttribute('aria-label', 'Xoá tìm kiếm');
    button.innerHTML = icon('close');
    bar.appendChild(button);

    button.addEventListener('click', () => {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
      updateClearButton(input, button);
    });
    input.addEventListener('input', () => updateClearButton(input, button));
    updateClearButton(input, button);
  });
};

let observer = null;

export const observeSearchClears = () => {
  enhanceSearchClears();
  if (observer || !document.body) return;
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) enhanceSearchClears(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
};
