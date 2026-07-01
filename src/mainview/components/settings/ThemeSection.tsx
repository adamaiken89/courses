import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '../../stores/settingsStore';
import type { Theme } from '../../themes';
import { selectableCardVariants } from '../ui';

const THEME_CARDS: { id: Theme; icon: string; labelKey: string; descKey: string }[] = [
  {
    id: 'dark',
    icon: 'icons.themeDark',
    labelKey: 'settings.themes.dark',
    descKey: 'settings.themes.darkDesc',
  },
  {
    id: 'oled',
    icon: 'icons.themeOled',
    labelKey: 'settings.themes.oled',
    descKey: 'settings.themes.oledDesc',
  },
  {
    id: 'nord',
    icon: 'icons.themeNord',
    labelKey: 'settings.themes.nord',
    descKey: 'settings.themes.nordDesc',
  },
  {
    id: 'sepia',
    icon: 'icons.themeSepia',
    labelKey: 'settings.themes.sepia',
    descKey: 'settings.themes.sepiaDesc',
  },
  {
    id: 'gruvbox',
    icon: 'icons.themeGruvbox',
    labelKey: 'settings.themes.gruvbox',
    descKey: 'settings.themes.gruvboxDesc',
  },
  {
    id: 'light',
    icon: 'icons.themeLight',
    labelKey: 'settings.themes.light',
    descKey: 'settings.themes.lightDesc',
  },
  {
    id: 'solarized-dark',
    icon: 'icons.themeSolarized',
    labelKey: 'settings.themes.solarized',
    descKey: 'settings.themes.solarizedDesc',
  },
  {
    id: 'catppuccin',
    icon: 'icons.themeCatppuccin',
    labelKey: 'settings.themes.catppuccin',
    descKey: 'settings.themes.catppuccinDesc',
  },
  {
    id: 'dracula',
    icon: 'icons.themeDracula',
    labelKey: 'settings.themes.dracula',
    descKey: 'settings.themes.draculaDesc',
  },
  {
    id: 'tokyo-night',
    icon: 'icons.themeTokyoNight',
    labelKey: 'settings.themes.tokyoNight',
    descKey: 'settings.themes.tokyoNightDesc',
  },
  {
    id: 'rose-pine',
    icon: 'icons.themeRosePine',
    labelKey: 'settings.themes.rosePine',
    descKey: 'settings.themes.rosePineDesc',
  },
  {
    id: 'everforest',
    icon: 'icons.themeEverforest',
    labelKey: 'settings.themes.everforest',
    descKey: 'settings.themes.everforestDesc',
  },
];

export default function ThemeSection() {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <section className="bg-gray-800 rounded-xl p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">{t('settings.readingTheme')}</h3>
      <div className="grid grid-cols-2 gap-3">
        {THEME_CARDS.map((tc) => (
          <button
            key={tc.id}
            onClick={() => setTheme(tc.id)}
            className={`text-left ${selectableCardVariants({ selected: theme === tc.id })}`}
          >
            <div className="text-base">{t(tc.icon)}</div>
            <div className="text-sm font-medium mt-1">{t(tc.labelKey)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{t(tc.descKey)}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
