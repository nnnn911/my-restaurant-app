/**
 * scroll.js - Scroll helpers that account for fixed navbar offset
 */

export const getNavbarOffset = () => {
  const navbar = document.getElementById('navbar');
  if (!navbar) return 0;
  return Math.ceil(navbar.getBoundingClientRect().height);
};

export const scrollToElementWithOffset = (el, { behavior = 'smooth', extraOffset = 0 } = {}) => {
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY;
  const offset = getNavbarOffset() + extraOffset;
  const top = Math.max(0, Math.floor(y - offset));
  window.scrollTo({ top, behavior });
};

export const scrollToIdWithOffset = (id, opts) => {
  if (!id) return;
  const el = document.getElementById(id);
  scrollToElementWithOffset(el, opts);
};
