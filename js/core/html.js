export const escapeHtml = (value) =>
  (value ?? '')
    .toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const escapeAttr = (value) => escapeHtml(value).replaceAll('`', '&#96;');
