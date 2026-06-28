import '../i18n';

import { beforeEach, describe, expect, test } from 'bun:test';

import { useSettingsStore } from './settingsStore';

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState(useSettingsStore.getInitialState());
});

describe('settingsStore', () => {
  test('default state', () => {
    const s = useSettingsStore.getState();
    expect(s.fontSize).toBe(16);
    expect(s.theme).toBe('dark');
    expect(s.contentWidth).toBe('standard');
    expect(s.showSections).toBe(true);
    expect(s.focusMode).toBe(false);
    expect(s.locale).toBe('en-US');
    expect(s.hasApiKey).toBe(false);
  });

  test('incFontSize increases by 2, max 28', () => {
    useSettingsStore.getState().incFontSize();
    expect(useSettingsStore.getState().fontSize).toBe(18);
    useSettingsStore.setState({ fontSize: 27 });
    useSettingsStore.getState().incFontSize();
    expect(useSettingsStore.getState().fontSize).toBe(28);
  });

  test('decFontSize decreases by 2, min 10', () => {
    useSettingsStore.getState().decFontSize();
    expect(useSettingsStore.getState().fontSize).toBe(14);
    useSettingsStore.setState({ fontSize: 11 });
    useSettingsStore.getState().decFontSize();
    expect(useSettingsStore.getState().fontSize).toBe(10);
  });

  test('setFontSize sets exact value and persists', () => {
    useSettingsStore.getState().setFontSize(20);
    expect(useSettingsStore.getState().fontSize).toBe(20);
    expect(JSON.parse(localStorage.getItem('coursereader-fontsize')!)).toBe(20);
  });

  test('cycleTheme rotates through THEMES', () => {
    const initial = useSettingsStore.getState().theme;
    useSettingsStore.getState().cycleTheme();
    expect(useSettingsStore.getState().theme).not.toBe(initial);
  });

  test('setTheme sets theme and persists', () => {
    useSettingsStore.getState().setTheme('sepia');
    expect(useSettingsStore.getState().theme).toBe('sepia');
    expect(JSON.parse(localStorage.getItem('coursereader-theme')!)).toBe('sepia');
  });

  test('setContentWidth sets width and persists', () => {
    useSettingsStore.getState().setContentWidth('wide');
    expect(useSettingsStore.getState().contentWidth).toBe('wide');
    expect(JSON.parse(localStorage.getItem('coursereader-width')!)).toBe('wide');
  });

  test('toggleSections flips showSections', () => {
    useSettingsStore.getState().toggleSections();
    expect(useSettingsStore.getState().showSections).toBe(false);
    useSettingsStore.getState().toggleSections();
    expect(useSettingsStore.getState().showSections).toBe(true);
  });

  test('toggleFocusMode flips focusMode and persists', () => {
    useSettingsStore.getState().toggleFocusMode();
    expect(useSettingsStore.getState().focusMode).toBe(true);
    expect(JSON.parse(localStorage.getItem('coursereader-focus')!)).toBe(true);
  });

  test('setHasApiKey sets key status', () => {
    useSettingsStore.getState().setHasApiKey(true);
    expect(useSettingsStore.getState().hasApiKey).toBe(true);
  });

  test('setLocale changes locale and persists', () => {
    useSettingsStore.getState().setLocale('zh-TW');
    expect(useSettingsStore.getState().locale).toBe('zh-TW');
    expect(JSON.parse(localStorage.getItem('coursereader-locale')!)).toBe('zh-TW');
  });
});
