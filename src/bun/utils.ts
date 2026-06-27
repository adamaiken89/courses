export function normalizeModuleId(id: string | number): string {
  if (typeof id === 'number') return String(id).padStart(2, '0');
  return id;
}
