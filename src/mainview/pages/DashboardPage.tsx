import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { logger } from '../logger';
import { showToast } from '../toast';
import PageLayout from '../layouts/PageLayout';
import PageHeader from '../layouts/PageHeader';
import PageContent from '../layouts/PageContent';
import {
  COMPLETION_GREEN,
  ACCENT_INDIGO_LIGHT,
  WARNING_AMBER,
  DASHBOARD_DEFAULT_TEXT,
} from '../colors';
import type { CourseStats, GlobalStats } from '../../bun/stats';

interface DashboardPageProps {
  courseID?: string;
  onBack: () => void;
}

function StatCard({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: color || DASHBOARD_DEFAULT_TEXT }}>
        {value}
        {suffix && <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

export default function DashboardPage({ courseID, onBack }: DashboardPageProps) {
  const { t } = useTranslation();
  const [courseStats, setCourseStats] = useState<CourseStats | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (courseID) {
      api.stats
        .course(courseID)
        .then((s) => {
          setCourseStats(s);
          setLoading(false);
        })
        .catch((err) => {
          logger.warn({ err }, 'Failed to load course stats');
          showToast.error('toast.loadFailed');
          setLoading(false);
        });
    } else {
      api.stats
        .global()
        .then((s) => {
          setGlobalStats(s);
          setLoading(false);
        })
        .catch((err) => {
          logger.warn({ err }, 'Failed to load global stats');
          showToast.error('toast.loadFailed');
          setLoading(false);
        });
    }
  }, [courseID]);

  if (loading) {
    return (
      <PageLayout>
        <PageHeader onBack={onBack} title={t('dashboard.title')} />
        <PageContent>
          <div className="text-center text-gray-500 py-12">{t('common.loading')}</div>
        </PageContent>
      </PageLayout>
    );
  }

  if (courseStats) {
    const completionPct =
      courseStats.totalModules > 0
        ? Math.round((courseStats.completedModules / courseStats.totalModules) * 100)
        : 0;

    return (
      <PageLayout>
        <PageHeader onBack={onBack} title={t('dashboard.courseStats')} />
        <PageContent className="max-w-2xl mx-auto w-full">
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard
              label={t('dashboard.modulesDone')}
              value={`${courseStats.completedModules}/${courseStats.totalModules}`}
              suffix={`(${completionPct}%)`}
              color={completionPct === 100 ? COMPLETION_GREEN : ACCENT_INDIGO_LIGHT}
            />
            <StatCard
              label={t('dashboard.avgQuizScore')}
              value={courseStats.avgQuizScore}
              suffix="%"
              color={courseStats.avgQuizScore >= 80 ? COMPLETION_GREEN : WARNING_AMBER}
            />
            <StatCard
              label={t('dashboard.srsDue')}
              value={courseStats.srsDueCount}
              suffix={`/ ${courseStats.srsTotalCards}`}
              color={WARNING_AMBER}
            />
            <StatCard
              label={t('dashboard.streak')}
              value={courseStats.streak}
              suffix="days"
              color={COMPLETION_GREEN}
            />
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-gray-400 mb-2">{t('dashboard.studyTime')}</p>
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
                style={{
                  width: `${Math.min(100, (courseStats.totalStudyMinutes / (courseStats.totalModules * 60)) * 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('dashboard.minutes', { count: courseStats.totalStudyMinutes })}
            </p>
          </div>

          {courseStats.recentSessions.length > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 mb-2">
                {t('dashboard.recentActivity')}
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {courseStats.recentSessions.slice(0, 10).map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span className="shrink-0 w-6 text-gray-600">{s.date.slice(5)}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        s.type === 'reading'
                          ? 'bg-indigo-500'
                          : s.type === 'quiz'
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                      }`}
                    />
                    <span className="capitalize">{s.type}</span>
                    <span className="ml-auto">{s.durationMinutes}m</span>
                    {s.score != null && (
                      <span className="text-gray-600">
                        {s.score}/{s.total}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </PageContent>
      </PageLayout>
    );
  }

  if (globalStats) {
    return (
      <PageLayout>
        <PageHeader onBack={onBack} title={t('dashboard.globalStats')} />
        <PageContent className="max-w-2xl mx-auto w-full">
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard
              label={t('dashboard.modulesDone')}
              value={`${globalStats.totalCompletedModules}/${globalStats.totalModules}`}
            />
            <StatCard
              label={t('dashboard.streak')}
              value={globalStats.streak}
              suffix="days"
              color={COMPLETION_GREEN}
            />
            <StatCard
              label={t('dashboard.studyTime')}
              value={t('dashboard.minutes', { count: globalStats.totalStudyMinutes })}
            />
            <StatCard label={t('dashboard.courses')} value={globalStats.totalCourses} />
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 mb-2">
              {t('dashboard.courseProgress')}
            </p>
            <div className="space-y-2">
              {globalStats.courseSummaries.map((cs) => {
                const pct = cs.total > 0 ? Math.round((cs.completed / cs.total) * 100) : 0;
                return (
                  <div key={cs.courseID}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-gray-300 truncate">{cs.courseName}</span>
                      <span className="text-gray-500 tabular-nums">
                        {cs.completed}/{cs.total}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader onBack={onBack} title={t('dashboard.title')} />
      <PageContent>
        <div className="text-center text-gray-500 py-12">{t('dashboard.noData')}</div>
      </PageContent>
    </PageLayout>
  );
}
