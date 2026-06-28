import { describe, expect, mock, test, beforeEach } from 'bun:test';

import { fsMockImpl } from '../test-fs-shared';

const mockExecSync = mock<(cmd: string) => void>();
const mockExistsSync = mock<(p: string) => boolean>();
const mockMkdirSync = mock<(p: string, opts?: unknown) => void>();
const mockReadFileSync = mock<(p: string, enc?: string) => string>();
const mockWriteFileSync = mock<(p: string, data: string) => void>();
const mockReaddirSync =
  mock<(p: string, opts?: unknown) => Array<{ name: string; isDirectory: () => boolean }>>();
const mockRmSync = mock<(p: string, opts?: unknown) => void>();
const mockCpSync = mock<(src: string, dest: string, opts?: unknown) => void>();

mock.module('child_process', () => ({
  execSync: mockExecSync,
}));

let storageData: Record<string, unknown> = {};

let mockSubjectsDir: string | null = null;

mock.module('./utils', () => ({
  findSubjectsDir: () => mockSubjectsDir,
  normalizeModuleId: (id: string | number) => String(id).padStart(2, '0'),
}));

mock.module('./logger', () => ({
  logger: {
    info: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
  },
}));

type Sync = typeof import('./sync');
let sync: Sync;

beforeEach(() => {
  storageData = {};
  mockSubjectsDir = null;
  mockExecSync.mockReset();
  mockExistsSync.mockReset();
  mockMkdirSync.mockReset();
  mockReadFileSync.mockReset();
  mockWriteFileSync.mockReset();
  mockReaddirSync.mockReset();
  mockRmSync.mockReset();
  mockCpSync.mockReset();
  Object.assign(fsMockImpl, {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    readdirSync: mockReaddirSync,
    rmSync: mockRmSync,
    cpSync: mockCpSync,
  });
  mockExistsSync.mockImplementation((p: string) => p.includes('data.json'));
  mockReadFileSync.mockImplementation((p: string, _enc?: string) =>
    p.includes('data.json') ? JSON.stringify(storageData) : '',
  );
  mockWriteFileSync.mockImplementation((p: string, data: string) => {
    if (p.includes('data.json')) Object.assign(storageData, JSON.parse(data));
  });
  mockMkdirSync.mockImplementation(() => {});
});

describe('isSyncing', () => {
  test('returns false initially', async () => {
    sync = await import('./sync');
    expect(sync.isSyncing()).toBe(false);
  });
});

describe('syncCourses', () => {
  test('returns error when no repo configured', async () => {
    sync = await import('./sync');
    const result = await sync.syncCourses();
    expect(result.success).toBe(false);
    expect(result.message).toBe('No remote repository configured');
  });

  test('returns up-to-date when same commit', async () => {
    storageData = { remoteRepoURL: 'https://github.com/owner/repo', lastSyncedCommit: 'abc123' };
    mockSubjectsDir = '/tmp/subjects';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sha: 'abc123' }),
      } as Response),
    ) as unknown as typeof globalThis.fetch;

    sync = await import('./sync');
    const result = await sync.syncCourses();
    expect(result.success).toBe(true);
    expect(result.unchanged).toBe(true);
    expect(result.message).toBe('Already up to date');

    globalThis.fetch = originalFetch;
  });

  test('returns error on invalid repo URL format', async () => {
    storageData = { remoteRepoURL: 'https://gitlab.com/owner/repo' };
    mockSubjectsDir = '/tmp/subjects';

    sync = await import('./sync');
    const result = await sync.syncCourses();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid GitHub URL format');
  });

  test('returns error when courses dir not found', async () => {
    storageData = { remoteRepoURL: 'https://github.com/owner/repo', lastSyncedCommit: 'oldhash' };
    mockSubjectsDir = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sha: 'newhash' }),
      } as Response),
    ) as unknown as typeof globalThis.fetch;

    sync = await import('./sync');
    const result = await sync.syncCourses();
    expect(result.success).toBe(false);
    expect(result.message).toBe('Courses directory not found');

    globalThis.fetch = originalFetch;
  });

  test('handles sync failure', async () => {
    storageData = { remoteRepoURL: 'https://github.com/owner/repo' };
    mockSubjectsDir = '/tmp/subjects';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sha: 'newhash' }),
      } as Response),
    ) as unknown as typeof globalThis.fetch;

    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValueOnce([]).mockReturnValueOnce([]);

    sync = await import('./sync');
    const result = await sync.syncCourses();
    expect(result.success).toBe(false);

    globalThis.fetch = originalFetch;
  });

  test('handles GitHub API failure', async () => {
    storageData = { remoteRepoURL: 'https://github.com/owner/repo' };
    mockSubjectsDir = '/tmp/subjects';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 403,
      } as Response),
    ) as unknown as typeof globalThis.fetch;

    sync = await import('./sync');
    const result = await sync.syncCourses();
    expect(result.success).toBe(false);
    expect(result.message).toContain('GitHub API error');
    expect(result.message).toContain('403');

    globalThis.fetch = originalFetch;
  });
});
