import { useTranslation } from 'react-i18next';
import CourseSwitcher from '../components/CourseSwitcher';
import PageHeader from '../layouts/PageHeader';
import PageLayout from '../layouts/PageLayout';
import PageContent from '../layouts/PageContent';
import type { Course, ModuleMeta } from '../../bun/types';

interface Props {
  course: Course;
  onSelectModule: (module: ModuleMeta) => void;
  onSelectCourse: (course: Course) => void;
  onOpenSettings: () => void;
  onOpenBookmarks: () => void;
  onOpenDashboard: () => void;
}

export default function ModuleListPage({
  course,
  onSelectModule,
  onSelectCourse,
  onOpenSettings,
  onOpenBookmarks,
  onOpenDashboard,
}: Props) {
  const { t } = useTranslation();

  return (
    <PageLayout>
      <PageHeader
        title={course.displayName}
        center={<CourseSwitcher currentCourseId={course.id} onSelect={onSelectCourse} />}
        actions={
          <>
            <button
              onClick={onOpenDashboard}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title={t('dashboard.title')}
            >
              {t('icons.stats')}
            </button>
            <button
              onClick={onOpenBookmarks}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              {t('common.bookmarks')}
            </button>
            <button
              onClick={onOpenSettings}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              {t('common.settings')}
            </button>
          </>
        }
      />

      <PageContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {course.modules.map((mod, i) => (
            <button
              key={mod.id}
              onClick={() => onSelectModule(mod)}
              className="text-left bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl p-5 transition-colors group cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-900/50 text-indigo-400 text-sm font-bold">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-white group-hover:text-indigo-400 transition-colors">
                    {mod.name}
                  </h2>
                  {mod.timeHours > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{mod.timeHours}h</p>
                  )}
                  {mod.topics && mod.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {mod.topics.map((t, ti) => (
                        <span
                          key={ti}
                          className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-gray-600 group-hover:text-indigo-400 shrink-0 mt-1">→</span>
              </div>
            </button>
          ))}
        </div>
      </PageContent>
    </PageLayout>
  );
}
