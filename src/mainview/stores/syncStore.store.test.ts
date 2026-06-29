import { beforeEach, describe, expect, test } from 'bun:test';

import { clearMocks, deleteMock, mockResponse, setupRPC } from '../test-utils';
import { useSyncStore } from './syncStore';

setupRPC();

beforeEach(() => {
  useSyncStore.setState({
    lastSyncTime: null,
    lastSyncedCommit: null,
    isSyncing: false,
    remoteRepoURL: '',
    error: null,
  });
  clearMocks();
});

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
    const origError = console.error;
    const origWarn = console.warn;
    console.error = () => {};
    console.warn = () => {};
    deleteMock('getSyncStatus');
    await useSyncStore.getState().loadStatus();
    expect(useSyncStore.getState().error).toBeTruthy();
    console.error = origError;
    console.warn = origWarn;
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
    deleteMock('syncStart');
    await useSyncStore.getState().startSync();
    expect(useSyncStore.getState().isSyncing).toBe(true);
  });

  test('startSync handles exception', async () => {
    const origError = console.error;
    const origWarn = console.warn;
    console.error = () => {};
    console.warn = () => {};
    deleteMock('syncStart');
    await useSyncStore.getState().startSync();
    expect(useSyncStore.getState().isSyncing).toBe(false);
    expect(useSyncStore.getState().error).toBeTruthy();
    console.error = origError;
    console.warn = origWarn;
  });

  test('setRepoURL sets URL and clears error', async () => {
    mockResponse('syncSetURL', { ok: true });
    await useSyncStore.getState().setRepoURL('https://github.com/user/new-repo');
    expect(useSyncStore.getState().remoteRepoURL).toBe('https://github.com/user/new-repo');
    expect(useSyncStore.getState().error).toBeNull();
  });

  test('setRepoURL handles error', async () => {
    const origError = console.error;
    const origWarn = console.warn;
    console.error = () => {};
    console.warn = () => {};
    deleteMock('syncSetURL');
    await useSyncStore.getState().setRepoURL('https://invalid');
    expect(useSyncStore.getState().remoteRepoURL).toBe('');
    expect(useSyncStore.getState().error).toBeTruthy();
    console.error = origError;
    console.warn = origWarn;
  });
});
