import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

export function normalizeModuleId(id: string | number): string {
  if (typeof id === 'number') return String(id).padStart(2, '0');
  return id;
}

export function findSubjectsDir(): string | null {
  const dir = dirname(fileURLToPath(import.meta.url));
  const candidate = resolve(dir, 'subjects');
  if (existsSync(candidate)) {
    console.log(`Found subjects directory at: ${candidate}`);
    return candidate;
  }

  console.log(`Subjects directory not found in ${candidate}. Checking bundle path...`);
  return resolve(dir, '..', 'subjects');
}
