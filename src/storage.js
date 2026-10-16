export const STORAGE_KEY = 'jlpt-wordbook:review:v1';

export function loadSaved(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { saved: {}, available: true };
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== 1) return { saved: {}, available: false };
    return { saved, available: true };
  } catch {
    return { saved: {}, available: false };
  }
}

export function saveReview(storage, value) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
