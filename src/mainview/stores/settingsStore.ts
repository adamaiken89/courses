import { create } from 'zustand';

import i18n from '../i18n';
import type { Theme } from '../themes';
import { THEMES } from '../themes';
import { getStored, store } from './storage-utils';

export type ContentWidth = 'narrow' | 'standard' | 'wide';
export type TransitionStyle = 'none' | 'flip' | 'slide' | 'fade';

interface SettingsState {
  fontSize: number;
  theme: Theme;
  contentWidth: ContentWidth;
  showSections: boolean;
  hasApiKey: boolean;
  focusMode: boolean;
  locale: string;
  transitionStyle: TransitionStyle;
  incFontSize: () => void;
  decFontSize: () => void;
  setFontSize: (v: number) => void;
  cycleTheme: () => void;
  setTheme: (t: Theme) => void;
  setContentWidth: (v: ContentWidth) => void;
  toggleSections: () => void;
  setHasApiKey: (v: boolean) => void;
  toggleFocusMode: () => void;
  setLocale: (l: string) => void;
  setTransitionStyle: (v: TransitionStyle) => void;
}

const migrateWidth = (): ContentWidth => {
  const saved = getStored<unknown>('coursereader-width', undefined);
  if (saved === 'narrow' || saved === 'standard' || saved === 'wide') return saved;
  const legacy = getStored<boolean | undefined>('coursereader-wide', undefined);
  if (legacy === true) return 'wide';
  if (legacy === false) return 'narrow';
  return 'standard';
};

export const useSettingsStore = create<SettingsState>((set) => ({
  fontSize: getStored<number>('coursereader-fontsize', 16),
  theme: getStored<Theme>('coursereader-theme', 'dark'),
  contentWidth: migrateWidth(),
  showSections: getStored<boolean>('coursereader-sections', true),
  focusMode: getStored<boolean>('coursereader-focus', false),
  locale: getStored<string>('coursereader-locale', 'en-US'),
  transitionStyle: getStored<TransitionStyle>('coursereader-transition', 'none'),
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

  setContentWidth: (v) => {
    store('coursereader-width', v);
    set({ contentWidth: v });
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
    void i18n.changeLanguage(l);
    set({ locale: l });
  },

  setTransitionStyle: (v) => {
    store('coursereader-transition', v);
    set({ transitionStyle: v });
  },
}));
