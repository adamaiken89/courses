import { beforeEach, describe, expect, test } from 'bun:test';

import { getStored, store } from './storage-utils';

beforeEach(() => {
  localStorage.clear();
});

describe('storage-utils', () => {
  test('getStored returns fallback when key not in localStorage', () => {
    expect(getStored('nonexistent', 'default')).toBe('default');
  });

  test('getStored returns parsed value when key exists', () => {
    localStorage.setItem('mykey', JSON.stringify({ foo: 'bar' }));
    expect(getStored<unknown>('mykey', null)).toEqual({ foo: 'bar' });
  });

  test('getStored returns fallback on JSON parse error', () => {
    localStorage.setItem('bad', 'not json{{{');
    expect(getStored('bad', 'fallback')).toBe('fallback');
  });

  test('store writes JSON to localStorage', () => {
    store('mykey', { nested: true, num: 42 });
    expect(JSON.parse(localStorage.getItem('mykey')!)).toEqual({ nested: true, num: 42 });
  });

  test('store handles errors gracefully', () => {
    // Should not throw
    store('key', 'value');
    expect(getStored('key', '')).toBe('value');
  });
});
