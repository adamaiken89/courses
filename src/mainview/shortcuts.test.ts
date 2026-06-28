import { describe, expect, test } from 'bun:test';

import { shortcutKey, SHORTCUTS } from './shortcuts';

describe('shortcuts', () => {
  test('shortcutKey returns key for known id', () => {
    expect(shortcutKey('search')).toBe('k');
    expect(shortcutKey('incFontSize')).toBe('=');
    expect(shortcutKey('prevModule')).toBe('ArrowLeft');
  });

  test('shortcutKey returns undefined for unknown id', () => {
    expect(shortcutKey('nonexistent')).toBeUndefined();
  });

  test('all shortcuts have non-empty key and id', () => {
    for (const s of SHORTCUTS) {
      expect(s.key.length).toBeGreaterThan(0);
      expect(s.id.length).toBeGreaterThan(0);
    }
  });

  test('each shortcut has valid scope', () => {
    const scopes = ['global', 'lesson', 'lessonToolbar'];
    for (const s of SHORTCUTS) {
      expect(scopes).toContain(s.scope);
    }
  });

  test('shortcutKey lookup is correct', () => {
    expect(shortcutKey('toggleSections')).toBe('s');
    expect(shortcutKey('findInPage')).toBe('f');
  });

  test('no duplicate key+scope combinations', () => {
    const seen = new Set<string>();
    for (const s of SHORTCUTS) {
      const scoped = `${s.scope}:${s.mod ? 'mod+' : ''}${s.key}`;
      expect(seen.has(scoped)).toBe(false);
      seen.add(scoped);
    }
  });
});
