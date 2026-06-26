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
import { shortcutKey } from '../../shortcuts';
import { useShortcuts } from '../../hooks/useShortcuts';

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
  onSearchCourse?: () => void;
}

export default function LessonToolbar({
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
  onSearchCourse,
}: LessonToolbarProps) {
  const { t } = useTranslation();
  const focusMode = useSettingsStore((s) => s.focusMode);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const incFontSize = useSettingsStore((s) => s.incFontSize);
  const decFontSize = useSettingsStore((s) => s.decFontSize);
  const cycleTheme = useSettingsStore((s) => s.cycleTheme);
  const theme = useSettingsStore((s) => s.theme);
  const contentWidth = useSettingsStore((s) => s.contentWidth);
  const setContentWidth = useSettingsStore((s) => s.setContentWidth);
  const toggleFocusMode = useSettingsStore((s) => s.toggleFocusMode);

  const SHORTCUT: Record<string, string> = {
    decFontSize: shortcutKey('decFontSize') ?? '-',
    incFontSize: shortcutKey('incFontSize') ?? '=',
    cycleTheme: shortcutKey('cycleTheme') ?? 't',
    toggleWidth: shortcutKey('toggleWidth') ?? 'w',
    bookmark: shortcutKey('bookmark') ?? 'b',
    focusMode: shortcutKey('focusMode') ?? 'f',
    pomodoro: shortcutKey('pomodoro') ?? 'p',
    tools: shortcutKey('tools') ?? 'l',
    reviewCards: shortcutKey('reviewCards') ?? 'c',
    quiz: shortcutKey('quiz') ?? 'q',
    review: shortcutKey('review') ?? 'r',
  };

  useShortcuts('lessonToolbar', {
    decFontSize,
    incFontSize,
    cycleTheme,
    toggleWidth: () => {
      const order: Array<'narrow' | 'standard' | 'wide'> = ['narrow', 'standard', 'wide'];
      const next = order[(order.indexOf(contentWidth) + 1) % order.length];
      setContentWidth(next);
    },
    bookmark: onToggleBookmark,
    focusMode: toggleFocusMode,
    pomodoro: onTogglePomodoro,
    tools: onToggleTools,
    reviewCards: () => onReviewCards?.(),
    quiz: () => onStartQuiz?.(),
    review: () => onStartReview?.(),
  });

  const s = (label: string, k: string) => `${label} (${SHORTCUT[k]})`;

  return (
    <div className="sticky top-0 z-40 bg-gray-800 border-b border-gray-700 px-4 py-1.5 flex items-center gap-2 shrink-0">
      {!focusMode && (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={decFontSize}
            title={s(t('lesson.decreaseFontSize'), 'decFontSize')}
          >
            A-
          </Button>
          <span className="text-xs text-gray-400 w-8 text-center">{fontSize}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={incFontSize}
            title={s(t('lesson.increaseFontSize'), 'incFontSize')}
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
            title={s(`${t('settings.readingTheme')}: ${t(THEME_LABELS[theme])}`, 'cycleTheme')}
          >
            {t(THEME_ICONS[theme])}
          </Button>
          <div className="h-3 w-px bg-gray-600" />
        </>
      )}
      {!focusMode && (
        <>
          <Button
            variant={contentWidth === 'wide' ? 'toggleActive' : 'toggle'}
            size="sm"
            onClick={() => {
              const order: Array<'narrow' | 'standard' | 'wide'> = ['narrow', 'standard', 'wide'];
              const next = order[(order.indexOf(contentWidth) + 1) % order.length];
              setContentWidth(next);
            }}
            title={s(t('lesson.toggleWideMode'), 'toggleWidth')}
          >
            {contentWidth === 'narrow'
              ? t('lesson.narrow')
              : contentWidth === 'standard'
                ? t('lesson.standard')
                : t('lesson.wide')}
          </Button>
          <div className="h-3 w-px bg-gray-600" />
          <Button
            variant={hasActiveBookmark ? 'toggleActive' : 'toggle'}
            size="sm"
            onClick={onToggleBookmark}
            title={s(t('lesson.bookmarkModule'), 'bookmark')}
          >
            {hasActiveBookmark ? t('icons.bookmarkFilled') : t('icons.bookmarkEmpty')}{' '}
            {t('lesson.bookmark')}
          </Button>
          <div className="h-3 w-px bg-gray-600" />
        </>
      )}
      <Button
        variant={focusMode ? 'toggleActive' : 'toggle'}
        size="sm"
        onClick={toggleFocusMode}
        title={s(t('lesson.focusMode'), 'focusMode')}
      >
        {focusMode ? t('lesson.focusModeOn') : t('lesson.focusModeOff')}
      </Button>
      <div className="h-3 w-px bg-gray-600" />
      <Button
        variant={showPomodoro ? 'toggleActive' : 'toggle'}
        size="sm"
        onClick={onTogglePomodoro}
        title={s(t('pomodoro.title'), 'pomodoro')}
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
            title={s(t('lesson.toggleStudyTools'), 'tools')}
          >
            {t('lesson.tools')}
          </Button>
        </>
      )}
      {!focusMode && (
        <>
          <div className="h-3 w-px bg-gray-600" />
          <Button
            variant="secondary"
            size="sm"
            onClick={onSearchCourse}
            title={t('lesson.searchCourse')}
          >
            {t('icons.search')} {t('lesson.searchCourse')}
          </Button>
        </>
      )}
      {onReviewCards && !focusMode && (
        <>
          <div className="h-3 w-px bg-gray-600" />
          <Button
            variant="secondary"
            size="sm"
            onClick={onReviewCards}
            title={s(t('lesson.reviewFlashcards'), 'reviewCards')}
          >
            {t('icons.cards')} {t('lesson.cards')}
          </Button>
        </>
      )}
      {!focusMode && (
        <>
          <div className="h-3 w-px bg-gray-600" />
          <Button
            variant="primary"
            size="sm"
            onClick={onStartQuiz}
            title={s(t('common.quiz'), 'quiz')}
          >
            {t('common.quiz')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onStartReview}
            title={s(t('common.review'), 'review')}
          >
            {t('common.review')}
          </Button>
        </>
      )}
      {totalModules > 0 && !focusMode && <div className="h-3 w-px bg-gray-600" />}
      {totalModules > 0 && !focusMode && (
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
