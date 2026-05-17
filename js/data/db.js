const STATIC_DB_URL = new URL('../../db.json', import.meta.url);

let staticDbCache = null;

export const loadStaticDb = () => {
  if (staticDbCache) return staticDbCache;
  try {
    const req = new XMLHttpRequest();
    req.open('GET', STATIC_DB_URL.href, false);
    req.send(null);
    if (req.status && (req.status < 200 || req.status >= 300)) {
      throw new Error(`Cannot load db.json (${req.status})`);
    }
    const data = JSON.parse(req.responseText || '{}');
    staticDbCache = data && typeof data === 'object' ? data : {};
  } catch (err) {
    console.error('[db] Không thể tải dữ liệu tĩnh từ db.json. Hãy chạy project qua localhost.', err);
    staticDbCache = {};
  }
  return staticDbCache;
};

export const getStaticArray = (key) => {
  const value = loadStaticDb()?.[key];
  return Array.isArray(value) ? value : [];
};
