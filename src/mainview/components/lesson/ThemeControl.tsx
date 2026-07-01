import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '../../stores/settingsStore';
import type { Theme } from '../../themes';
import { Button } from '../ui';

const THEME_LABELS: Record<Theme, string> = {
  dark: 'settings.themes.dark',
  oled: 'settings.themes.oled',
  nord: 'settings.themes.nord',
  sepia: 'settings.themes.sepia',
  gruvbox: 'settings.themes.gruvbox',
  light: 'settings.themes.light',
  'solarized-dark': 'settings.themes.solarized',
  catppuccin: 'settings.themes.catppuccin',
  dracula: 'settings.themes.dracula',
  'tokyo-night': 'settings.themes.tokyoNight',
  'rose-pine': 'settings.themes.rosePine',
  everforest: 'settings.themes.everforest',
};

const THEME_ICONS: Record<Theme, string> = {
  dark: 'icons.themeDark',
  oled: 'icons.themeOled',
  nord: 'icons.themeNord',
  sepia: 'icons.themeSepia',
  gruvbox: 'icons.themeGruvbox',
  light: 'icons.themeLight',
  'solarized-dark': 'icons.themeSolarized',
  catppuccin: 'icons.themeCatppuccin',
  dracula: 'icons.themeDracula',
  'tokyo-night': 'icons.themeTokyoNight',
  'rose-pine': 'icons.themeRosePine',
  everforest: 'icons.themeEverforest',
};

function ThemeControl() {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const cycleTheme = useSettingsStore((s) => s.cycleTheme);

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={cycleTheme}
      title={`${t('settings.readingTheme')}: ${t(THEME_LABELS[theme])}`}
    >
      {t(THEME_ICONS[theme])}
    </Button>
  );
}

export default ThemeControl;
