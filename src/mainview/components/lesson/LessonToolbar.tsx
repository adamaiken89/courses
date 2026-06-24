import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { toggleVariants } from '../ui';
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
  onStartQuiz?: () => void;
  onStartReview?: () => void;
  onSettings?: () => void;
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
  onStartQuiz,
  onStartReview,
  onSettings,
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
          <button
            onClick={decFontSize}
            className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            title={t('lesson.decreaseFontSize')}
          >
            A-
          </button>
          <span className="text-xs text-gray-400 w-8 text-center">{fontSize}</span>
          <button
            onClick={incFontSize}
            className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            title={t('lesson.increaseFontSize')}
          >
            A+
          </button>
          <div className="h-3 w-px bg-gray-600" />
        </>
      )}
      {!focusMode && (
        <>
          <button
            onClick={cycleTheme}
            className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            title={`${t('settings.readingTheme')}: ${t(THEME_LABELS[theme])}`}
          >
            {t(THEME_ICONS[theme])}
          </button>
          <div className="h-3 w-px bg-gray-600" />
        </>
      )}
      <button
        onClick={() => setWideMode(!wideMode)}
        className={toggleVariants({ active: wideMode })}
        title={t('lesson.toggleWideMode')}
      >
        {wideMode ? t('lesson.wide') : t('lesson.narrow')}
      </button>
      <div className="h-3 w-px bg-gray-600" />
      <button
        onClick={onToggleBookmark}
        className={toggleVariants({ active: hasActiveBookmark })}
        title={t('lesson.bookmarkModule')}
      >
        {hasActiveBookmark ? t('icons.bookmarkFilled') : t('icons.bookmarkEmpty')}{' '}
        {t('lesson.bookmark')}
      </button>
      <div className="h-3 w-px bg-gray-600" />
      <button
        onClick={toggleFocusMode}
        className={toggleVariants({ active: focusMode })}
        title={t('lesson.focusMode')}
      >
        {focusMode ? t('lesson.focusModeOn') : t('lesson.focusModeOff')}
      </button>
      <div className="h-3 w-px bg-gray-600" />
      <button
        onClick={onTogglePomodoro}
        className={toggleVariants({ active: showPomodoro })}
        title={t('pomodoro.title')}
      >
        {t('icons.pomodoro')}
      </button>
      {!focusMode && (
        <>
          <div className="h-3 w-px bg-gray-600" />
          <button
            onClick={onToggleTools}
            className={toggleVariants({ active: showTools })}
            title={t('lesson.toggleStudyTools')}
          >
            {t('lesson.tools')}
          </button>
        </>
      )}
      {onReviewCards && (
        <>
          <div className="h-3 w-px bg-gray-600" />
          <button
            onClick={onReviewCards}
            className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            title={t('lesson.reviewFlashcards')}
          >
            {t('icons.cards')} {t('lesson.cards')}
          </button>
        </>
      )}
      {!focusMode && (
        <>
          <div className="h-3 w-px bg-gray-600" />
          <button
            onClick={onStartQuiz}
            className="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded"
          >
            {t('common.quiz')}
          </button>
          <button
            onClick={onStartReview}
            className="px-2 py-1 text-xs bg-amber-700 hover:bg-amber-600 rounded"
          >
            {t('common.review')}
          </button>
          <button
            onClick={onSettings}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            title={t('common.settings')}
          >
            {t('icons.gear')}
          </button>
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
    </div>
  );
}
