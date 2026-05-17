export const readJson = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const writeJsonIfChanged = (key, value) => {
  const next = JSON.stringify(value);
  if (localStorage.getItem(key) !== next) localStorage.setItem(key, next);
};

export const removeStorageKey = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // localStorage may be unavailable in private/blocked contexts.
  }
};
