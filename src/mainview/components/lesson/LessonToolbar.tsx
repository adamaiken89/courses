import { useSettingsStore } from '../../stores/settingsStore';
import BookmarkButton from './BookmarkButton';
import CardsButton from './CardsButton';
import FocusPomodoroControls from './FocusPomodoroControls';
import FontSizeControl from './FontSizeControl';
import ProgressBadge from './ProgressBadge';
import QuizReviewButtons from './QuizReviewButtons';
import SearchCourseButton from './SearchCourseButton';
import ThemeControl from './ThemeControl';
import ToolsButton from './ToolsButton';
import WidthTransitionControl from './WidthTransitionControl';

export default function LessonToolbar() {
  const focusMode = useSettingsStore((s) => s.focusMode);

  if (focusMode) {
    return (
      <div className="sticky top-0 z-40 bg-gray-800 border-b border-gray-700 px-4 py-1.5 flex items-center gap-2 shrink-0">
        <FocusPomodoroControls />
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-40 bg-gray-800 border-b border-gray-700 px-4 py-1.5 flex items-center gap-2 shrink-0">
      <div className="flex items-center gap-2">
        <FontSizeControl />
      </div>
      <div className="flex items-center gap-2">
        <ThemeControl />
      </div>
      <div className="flex items-center gap-2">
        <WidthTransitionControl />
        <div className="h-3 w-px bg-gray-600" />
        <BookmarkButton />
      </div>
      <FocusPomodoroControls />
      <div className="flex items-center gap-2">
        <div className="h-3 w-px bg-gray-600" />
        <ToolsButton />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3 w-px bg-gray-600" />
        <SearchCourseButton />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3 w-px bg-gray-600" />
        <CardsButton />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3 w-px bg-gray-600" />
        <QuizReviewButtons />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3 w-px bg-gray-600" />
        <ProgressBadge />
      </div>
    </div>
  );
}
