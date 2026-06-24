import { create } from 'zustand';
import i18n from '../i18n';
import { THEMES } from '../themes';
import type { Theme } from '../themes';
import { getStored, store } from './storage-utils';

interface SettingsState {
  fontSize: number;
  theme: Theme;
  wideMode: boolean;
  showSections: boolean;
  hasApiKey: boolean;
  focusMode: boolean;
  locale: string;
  incFontSize: () => void;
  decFontSize: () => void;
  setFontSize: (v: number) => void;
  cycleTheme: () => void;
  setTheme: (t: Theme) => void;
  setWideMode: (v: boolean) => void;
  toggleSections: () => void;
  setHasApiKey: (v: boolean) => void;
  toggleFocusMode: () => void;
  setLocale: (l: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  fontSize: getStored<number>('coursereader-fontsize', 16),
  theme: getStored<Theme>('coursereader-theme', 'dark'),
  wideMode: getStored<boolean>('coursereader-wide', false),
  showSections: getStored<boolean>('coursereader-sections', true),
  focusMode: getStored<boolean>('coursereader-focus', false),
  locale: getStored<string>('coursereader-locale', 'en-US'),
  hasApiKey: false,

  incFontSize: () =>
    set((s) => {
      const next = Math.min(28, s.fontSize + 2);
      store('coursereader-fontsize', next);
      return { fontSize: next };
    }),

  decFontSize: () =>
    set((s) => {
      const next = Math.max(10, s.fontSize - 2);
      store('coursereader-fontsize', next);
      return { fontSize: next };
    }),

  setFontSize: (v) => {
    store('coursereader-fontsize', v);
    set({ fontSize: v });
  },

  cycleTheme: () =>
    set((s) => {
      const idx = THEMES.indexOf(s.theme);
      const next = THEMES[(idx + 1) % THEMES.length];
      store('coursereader-theme', next);
      return { theme: next };
    }),

  setTheme: (t) => {
    store('coursereader-theme', t);
    set({ theme: t });
  },

  setWideMode: (v) => {
    store('coursereader-wide', v);
    set({ wideMode: v });
  },

  toggleSections: () =>
    set((s) => {
      const next = !s.showSections;
      store('coursereader-sections', next);
      return { showSections: next };
    }),

  setHasApiKey: (v) => set({ hasApiKey: v }),

  toggleFocusMode: () =>
    set((s) => {
      const next = !s.focusMode;
      store('coursereader-focus', next);
      return { focusMode: next };
    }),

  setLocale: (l) => {
    store('coursereader-locale', l);
    i18n.changeLanguage(l);
    set({ locale: l });
  },
}));
