import { useDelayedUnmount } from './useDelayedUnmount';

export function useLessonAnimations(params: {
  showTools: boolean;
  focusMode: boolean;
  showSections: boolean;
  showPomodoro: boolean;
}) {
  return {
    showStudyTools: useDelayedUnmount(params.showTools && !params.focusMode, 250),
    showSectionsPanel: useDelayedUnmount(params.showSections && !params.focusMode, 250),
    showPomodoroTimer: useDelayedUnmount(params.showPomodoro, 200),
  };
}
