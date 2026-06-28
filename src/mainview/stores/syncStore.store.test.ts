import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { __setRPC } from '../api';
import { useSyncStore } from './syncStore';

type RPCProxy = { request: Record<string, (p: unknown) => Promise<unknown>> };
const mockResponses = new Map<string, unknown>();

const mockRPC: RPCProxy = {
  request: new Proxy({} as Record<string, (p: unknown) => Promise<unknown>>, {
    get(_, method: string) {
      return (_p: unknown) => {
        const response = mockResponses.get(method);
        if (response === undefined) return Promise.reject(new Error(`No mock for ${method}`));
        return Promise.resolve(response);
      };
    },
  }),
};

beforeAll(() => {
  __setRPC(mockRPC);
});

beforeEach(() => {
  useSyncStore.setState({
    lastSyncTime: null,
    lastSyncedCommit: null,
    isSyncing: false,
    remoteRepoURL: '',
    error: null,
  });
  mockResponses.clear();
});

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

describe('syncStore', () => {
  test('loadStatus sets sync state', async () => {
    const status = {
      lastSyncTime: '2024-01-01T00:00:00Z',
      lastSyncedCommit: 'abc',
      isSyncing: false,
      remoteRepoURL: 'https://github.com/user/repo',
    };
    mockResponse('getSyncStatus', status);
    await useSyncStore.getState().loadStatus();
    const state = useSyncStore.getState();
    expect(state.lastSyncTime).toBe('2024-01-01T00:00:00Z');
    expect(state.lastSyncedCommit).toBe('abc');
    expect(state.remoteRepoURL).toBe('https://github.com/user/repo');
    expect(state.error).toBeNull();
  });

  test('loadStatus handles error', async () => {
    mockResponses.delete('getSyncStatus');
    await useSyncStore.getState().loadStatus();
    expect(useSyncStore.getState().error).toBeTruthy();
  });

  test('startSync successful sync', async () => {
    mockResponse('syncStart', { success: true, commitHash: 'def', message: 'OK' });
    await useSyncStore.getState().startSync();
    const state = useSyncStore.getState();
    expect(state.lastSyncedCommit).toBe('def');
    expect(state.isSyncing).toBe(false);
    expect(state.error).toBeNull();
  });

  test('startSync failed sync', async () => {
    mockResponse('syncStart', { success: false, commitHash: '', message: 'Conflict' });
    await useSyncStore.getState().startSync();
    const state = useSyncStore.getState();
    expect(state.isSyncing).toBe(false);
    expect(state.error).toBe('Conflict');
  });

  test('startSync skips if already syncing', async () => {
    useSyncStore.setState({ isSyncing: true });
    mockResponses.delete('syncStart');
    await useSyncStore.getState().startSync();
    expect(useSyncStore.getState().isSyncing).toBe(true);
  });

  test('startSync handles exception', async () => {
    mockResponses.delete('syncStart');
    await useSyncStore.getState().startSync();
    expect(useSyncStore.getState().isSyncing).toBe(false);
    expect(useSyncStore.getState().error).toBeTruthy();
  });

  test('setRepoURL sets URL and clears error', async () => {
    mockResponse('syncSetURL', { ok: true });
    await useSyncStore.getState().setRepoURL('https://github.com/user/new-repo');
    expect(useSyncStore.getState().remoteRepoURL).toBe('https://github.com/user/new-repo');
    expect(useSyncStore.getState().error).toBeNull();
  });

  test('setRepoURL handles error', async () => {
    mockResponses.delete('syncSetURL');
    await useSyncStore.getState().setRepoURL('https://invalid');
    expect(useSyncStore.getState().remoteRepoURL).toBe('');
    expect(useSyncStore.getState().error).toBeTruthy();
  });
});
