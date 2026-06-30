import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { Bookmark } from '../../../bun/types';
import {
  ACCENT_INDIGO,
  ACCENT_INDIGO_LIGHT,
  COMPLETION_GREEN,
  COMPLETION_GREEN_DARK,
} from '../../colors';
import { useShortcuts } from '../../hooks/useShortcuts';
import { shortcutKey } from '../../shortcuts';
import { useBookmarksStore } from '../../stores/bookmarksStore';
import { countCompleted, useCompletionStore } from '../../stores/completionStore';
import { useCourseStore } from '../../stores/courseStore';
import { useLessonUIStore } from '../../stores/lessonUIStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { TransitionStyle } from '../../stores/settingsStore';
import { useViewStore } from '../../stores/viewStore';
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

const EMPTY_BOOKMARKS: Bookmark[] = [];

export default function LessonToolbar() {
  const { t } = useTranslation();

  const push = useViewStore((s) => s.push);
  const views = useViewStore((s) => s.views);
  const lastView = views[views.length - 1];
  const course = lastView?.type === 'lesson' ? lastView.course : null;
  const module = lastView?.type === 'lesson' ? lastView.module : null;

  const courses = useCourseStore((s) => s.courses);
  const completedCount = useCompletionStore((s) =>
    course ? countCompleted(s.completed, course.id) : 0,
  );
  const totalModules = course ? course.modules.length : 0;

  const k = course && module ? `${course.id}:${module.id}` : '';
  const byModule = useBookmarksStore((s) => s.byModule);
  const bookmarks = k ? (byModule[k] ?? EMPTY_BOOKMARKS) : EMPTY_BOOKMARKS;
  const hasActiveBookmark = bookmarks.some((b) => !b.sectionID);

  const showTools = useLessonUIStore((s) => s.showTools);
  const showPomodoro = useLessonUIStore((s) => s.showPomodoro);
  const toggleTools = useLessonUIStore((s) => s.toggleTools);
  const togglePomodoro = useLessonUIStore((s) => s.togglePomodoro);
  const setSearchCourseOpen = useLessonUIStore((s) => s.setSearchCourseOpen);

  const focusMode = useSettingsStore((s) => s.focusMode);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const incFontSize = useSettingsStore((s) => s.incFontSize);
  const decFontSize = useSettingsStore((s) => s.decFontSize);
  const cycleTheme = useSettingsStore((s) => s.cycleTheme);
  const theme = useSettingsStore((s) => s.theme);
  const contentWidth = useSettingsStore((s) => s.contentWidth);
  const setContentWidth = useSettingsStore((s) => s.setContentWidth);
  const toggleFocusMode = useSettingsStore((s) => s.toggleFocusMode);
  const transitionStyle = useSettingsStore((s) => s.transitionStyle);
  const setTransitionStyle = useSettingsStore((s) => s.setTransitionStyle);

  const cycleTransition = useCallback(() => {
    const order: TransitionStyle[] = ['none', 'flip', 'slide', 'fade'];
    const next = order[(order.indexOf(transitionStyle) + 1) % order.length];
    setTransitionStyle(next);
  }, [transitionStyle, setTransitionStyle]);

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
    cycleTransition: shortcutKey('cycleTransition') ?? 'x',
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
    bookmark: () => {
      if (!course || !module) return;
      const k = `${course.id}:${module.id}`;
      const bm = useBookmarksStore.getState().byModule[k] ?? [];
      const existing = bm.find((b) => !b.sectionID);
      if (existing) {
        void useBookmarksStore.getState().remove(existing.id);
      } else {
        void useBookmarksStore.getState().toggle(course.id, module.id, module.name, null);
      }
    },
    focusMode: toggleFocusMode,
    pomodoro: togglePomodoro,
    tools: toggleTools,
    reviewCards: () => {
      if (!course) return;
      const found = courses.find((c) => c.id === course.id);
      if (found) push({ type: 'userCardReview', course: found });
    },
    quiz: () => {
      if (!course || !module) return;
      push({ type: 'quiz', course, module });
    },
    review: () => {
      if (!course) return;
      push({ type: 'review', course });
    },
    cycleTransition: () => cycleTransition(),
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
            variant="secondary"
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
            variant="secondary"
            size="sm"
            onClick={cycleTransition}
            title={s(`${t('settings.pageTransition')}: ${t(`settings.transition${transitionStyle.charAt(0).toUpperCase() + transitionStyle.slice(1)}`)}`, 'cycleTransition')}
          >
            {transitionStyle === 'none'
              ? t('settings.transitionNone')
              : transitionStyle === 'flip'
                ? `↻ ${t('settings.transitionFlip')}`
                : transitionStyle === 'slide'
                  ? `→ ${t('settings.transitionSlide')}`
                  : `◦ ${t('settings.transitionFade')}`}
          </Button>
          <div className="h-3 w-px bg-gray-600" />
          <Button
            variant={hasActiveBookmark ? 'toggleActive' : 'toggle'}
            size="sm"
            onClick={() => {
              if (!course || !module) return;
              const k = `${course.id}:${module.id}`;
              const bm = useBookmarksStore.getState().byModule[k] ?? [];
              const existing = bm.find((b) => !b.sectionID);
              if (existing) {
                void useBookmarksStore.getState().remove(existing.id);
              } else {
                void useBookmarksStore.getState().toggle(course.id, module.id, module.name, null);
              }
            }}
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
      <Button
        variant={showPomodoro ? 'toggleActive' : 'toggle'}
        size="sm"
        onClick={togglePomodoro}
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
            onClick={toggleTools}
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
            onClick={() => setSearchCourseOpen(true)}
            title={t('lesson.searchCourse')}
          >
            {t('icons.search')} {t('lesson.searchCourse')}
          </Button>
        </>
      )}
      {course && !focusMode && (
        <>
          <div className="h-3 w-px bg-gray-600" />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const found = courses.find((c) => c.id === course.id);
              if (found) push({ type: 'userCardReview', course: found });
            }}
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
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!course || !module) return;
              push({ type: 'quiz', course, module });
            }}
            title={s(t('common.quiz'), 'quiz')}
          >
            {t('common.quiz')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!course) return;
              push({ type: 'review', course });
            }}
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
