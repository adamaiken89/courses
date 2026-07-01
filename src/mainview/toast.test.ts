import { beforeEach, describe, expect, mock, test } from 'bun:test';

let lastToast: unknown = null;

void mock.module('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => {
      lastToast = ['success', ...args];
      return 'toast-id';
    },
    error: (...args: unknown[]) => {
      lastToast = ['error', ...args];
      return 'toast-id';
    },
    info: (...args: unknown[]) => {
      lastToast = ['info', ...args];
      return 'toast-id';
    },
    warning: (...args: unknown[]) => {
      lastToast = ['warning', ...args];
      return 'toast-id';
    },
    promise: <T>(
      _promise: Promise<T>,
      msgs: { loading: string; success: string; error: string | (() => string) },
    ) => {
      lastToast = ['promise', msgs];
      return 'toast-id';
    },
  },
  Toaster: () => null,
}));

beforeEach(() => {
  lastToast = null;
});

describe('showToast', () => {
  test('success calls sonnerToast.success with translated key', async () => {
    const { showToast } = await import('./toast');
    const result = showToast.success('common.back');
    expect(result).toBe('toast-id');
    expect(lastToast).toEqual(['success', '← Back', undefined]);
  });

  test('success passes opts through', async () => {
    const { showToast } = await import('./toast');
    showToast.success('common.back', { duration: 5000 });
    expect(lastToast).toEqual(['success', '← Back', { duration: 5000 }]);
  });

  test('error calls sonnerToast.error with fallback key and default duration', async () => {
    const { showToast } = await import('./toast');
    showToast.error('common.error');
    expect(lastToast).toEqual(['error', 'common.error', { duration: 6000 }]);
  });

  test('error merges custom duration with default', async () => {
    const { showToast } = await import('./toast');
    showToast.error('common.error', { duration: 3000 });
    expect(lastToast).toEqual(['error', 'common.error', { duration: 3000 }]);
  });

  test('info passes through', async () => {
    const { showToast } = await import('./toast');
    showToast.info('common.info');
    expect(lastToast).toEqual(['info', 'common.info', undefined]);
  });

  test('warning passes through', async () => {
    const { showToast } = await import('./toast');
    showToast.warning('common.warning');
    expect(lastToast).toEqual(['warning', 'common.warning', undefined]);
  });

  test('promise calls sonnerToast.promise with translated messages', async () => {
    const { showToast } = await import('./toast');
    const promise = Promise.resolve('done');
    showToast.promise(promise, {
      loading: 'common.loading',
      success: 'common.success',
      error: 'common.error',
    });
    const [, msgs] = lastToast as [
      string,
      { loading: string; success: string; error: string | (() => string) },
    ];
    expect(msgs.loading).toBe('Loading...');
    expect(msgs.success).toBe('common.success');
    const errorFn = msgs.error as () => string;
    expect(typeof errorFn).toBe('function');
    expect(errorFn()).toBe('common.error');
  });

  test('promise with values translates with interpolation', async () => {
    const { showToast } = await import('./toast');
    showToast.success('common.back', { values: { name: 'test' } });
    expect(lastToast).toEqual(['success', '← Back', { values: { name: 'test' } }]);
  });
});
