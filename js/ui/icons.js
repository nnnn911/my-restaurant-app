import { escapeAttr } from '../core/html.js';

export const icon = (name, label = '', className = 'app-icon') => {
  const safeName = escapeAttr(name);
  const safeClass = escapeAttr(className);
  const safeLabel = escapeAttr(label);
  const alt = safeLabel ? `alt="${safeLabel}"` : 'alt="" aria-hidden="true"';
  return `<img class="${safeClass}" src="assets/icons/${safeName}.svg" ${alt}>`;
};
