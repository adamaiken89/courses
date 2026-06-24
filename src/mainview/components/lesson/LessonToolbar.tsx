import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../ui';
import {
  COMPLETION_GREEN,
  COMPLETION_GREEN_DARK,
  ACCENT_INDIGO,
  ACCENT_INDIGO_LIGHT,
} from '../../colors';
import type { Theme } from '../../themes';

const THEME_LABELS: Record<Theme, string> = {
  dark: 'settings.themes.dark',
  oled: 'settings.themes.oled',
  nord: 'settings.themes.nord',
  sepia: 'settings.themes.sepia',
  gruvbox: 'settings.themes.gruvbox',
  light: 'settings.themes.light',
  'solarized-dark': 'settings.themes.solarized',
  catppuccin: 'settings.themes.catppuccin',
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
};

interface LessonToolbarProps {
  focusMode: boolean;
  showTools: boolean;
  showPomodoro: boolean;
  hasActiveBookmark: boolean;
  completedCount: number;
  totalModules: number;
  onToggleBookmark: () => void;
  onToggleTools: () => void;
  onTogglePomodoro: () => void;
  onReviewCards?: () => void;
  onSettings?: () => void;
  onStartQuiz?: () => void;
  onStartReview?: () => void;
}

export default function LessonToolbar({
  focusMode,
  showTools,
  showPomodoro,
  hasActiveBookmark,
  completedCount,
  totalModules,
  onToggleBookmark,
  onToggleTools,
  onTogglePomodoro,
  onReviewCards,
  onSettings,
  onStartQuiz,
  onStartReview,
}: LessonToolbarProps) {
  const { t } = useTranslation();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const incFontSize = useSettingsStore((s) => s.incFontSize);
  const decFontSize = useSettingsStore((s) => s.decFontSize);
  const cycleTheme = useSettingsStore((s) => s.cycleTheme);
  const theme = useSettingsStore((s) => s.theme);
  const wideMode = useSettingsStore((s) => s.wideMode);
  const setWideMode = useSettingsStore((s) => s.setWideMode);
  const toggleFocusMode = useSettingsStore((s) => s.toggleFocusMode);

  return (
    <div className="sticky top-0 z-40 bg-gray-800 border-b border-gray-700 px-4 py-1.5 flex items-center gap-2 shrink-0">
      {!focusMode && (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={decFontSize}
            title={t('lesson.decreaseFontSize')}
          >
            A-
          </Button>
          <span className="text-xs text-gray-400 w-8 text-center">{fontSize}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={incFontSize}
            title={t('lesson.increaseFontSize')}
          >
            A+
          </Button>
          <div className="h-3 w-px bg-gray-600" />
        </>
      )}
      {!focusMode && (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={cycleTheme}
            title={`${t('settings.readingTheme')}: ${t(THEME_LABELS[theme])}`}
          >
            {t(THEME_ICONS[theme])}
          </Button>
          <div className="h-3 w-px bg-gray-600" />
        </>
      )}
      <Button
        variant={wideMode ? 'toggleActive' : 'toggle'}
        size="sm"
        onClick={() => setWideMode(!wideMode)}
        title={t('lesson.toggleWideMode')}
      >
        {wideMode ? t('lesson.wide') : t('lesson.narrow')}
      </Button>
      <div className="h-3 w-px bg-gray-600" />
      <Button
        variant={hasActiveBookmark ? 'toggleActive' : 'toggle'}
        size="sm"
        onClick={onToggleBookmark}
        title={t('lesson.bookmarkModule')}
      >
        {hasActiveBookmark ? t('icons.bookmarkFilled') : t('icons.bookmarkEmpty')}{' '}
        {t('lesson.bookmark')}
      </Button>
      <div className="h-3 w-px bg-gray-600" />
      <Button
        variant={focusMode ? 'toggleActive' : 'toggle'}
        size="sm"
        onClick={toggleFocusMode}
        title={t('lesson.focusMode')}
      >
        {focusMode ? t('lesson.focusModeOn') : t('lesson.focusModeOff')}
      </Button>
      <div className="h-3 w-px bg-gray-600" />
      <Button
        variant={showPomodoro ? 'toggleActive' : 'toggle'}
        size="sm"
        onClick={onTogglePomodoro}
        title={t('pomodoro.title')}
      >
        {t('icons.pomodoro')}
      </Button>
      {!focusMode && (
        <>
          <div className="h-3 w-px bg-gray-600" />
          <Button
            variant={showTools ? 'toggleActive' : 'toggle'}
            size="sm"
            onClick={onToggleTools}
            title={t('lesson.toggleStudyTools')}
          >
            {t('lesson.tools')}
          </Button>
        </>
      )}
      {onReviewCards && (
        <>
          <div className="h-3 w-px bg-gray-600" />
          <Button
            variant="secondary"
            size="sm"
            onClick={onReviewCards}
            title={t('lesson.reviewFlashcards')}
          >
            {t('icons.cards')} {t('lesson.cards')}
          </Button>
        </>
      )}
      {!focusMode && (
        <>
          <div className="h-3 w-px bg-gray-600" />
          <Button variant="primary" size="sm" onClick={onStartQuiz}>
            {t('common.quiz')}
          </Button>
          <Button variant="secondary" size="sm" onClick={onStartReview}>
            {t('common.review')}
          </Button>
        </>
      )}
      {totalModules > 0 && <div className="h-3 w-px bg-gray-600" />}
      {totalModules > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1 rounded-full overflow-hidden bg-gray-700">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(completedCount / totalModules) * 100}%`,
                background:
                  completedCount === totalModules
                    ? `linear-gradient(90deg, ${COMPLETION_GREEN}, ${COMPLETION_GREEN_DARK})`
                    : `linear-gradient(90deg, ${ACCENT_INDIGO}, ${ACCENT_INDIGO_LIGHT})`,
              }}
            />
          </div>
          <span className="text-xs text-gray-400 tabular-nums">
            {completedCount}/{totalModules}
          </span>
        </div>
      )}
      {onSettings && (
        <>
          <div className="h-3 w-px bg-gray-600" />
          <Button variant="ghost" size="sm" onClick={onSettings} title={t('common.settings')}>
            {t('common.settings')}
          </Button>
        </>
      )}
    </div>
  );
}
