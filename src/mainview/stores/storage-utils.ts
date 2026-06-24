export function getStored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key)!) ?? fallback;
  } catch {
    return fallback;
  }
}

export function store(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* noop */
  }
}
