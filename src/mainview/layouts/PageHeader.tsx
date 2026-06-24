import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import BackToCourseList from '../components/BackToCourseList';
import { useViewStore } from '../stores/viewStore';

interface PageHeaderProps {
  onBack?: () => void;
  backLabel?: string;
  title?: string;
  center?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  toolbar?: ReactNode;
  hideHeaderActions?: boolean;
}

export default function PageHeader({
  onBack,
  backLabel,
  title,
  center,
  actions,
  children,
  toolbar,
  hideHeaderActions,
}: PageHeaderProps) {
  const { t } = useTranslation();
  const push = useViewStore((s) => s.push);

  return (
    <header className="relative z-40 bg-gray-800 border-b border-gray-700 shrink-0 min-h-7 flex flex-col">
      <div className="px-4 py-2 flex items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BackToCourseList />
          <div className="h-4 w-px bg-gray-600" />
          {onBack && (
            <>
              <button
                onClick={onBack}
                className="text-gray-400 hover:text-white transition-colors text-sm shrink-0"
              >
                {backLabel ?? t('common.back')}
              </button>
              <div className="h-4 w-px bg-gray-600" />
            </>
          )}
          {title && <span className="text-sm font-medium text-gray-200 truncate">{title}</span>}
        </div>

        {center && <div className="absolute left-1/2 -translate-x-1/2 z-50">{center}</div>}

        {actions && <div className="ml-auto flex items-center gap-1.5">{actions}</div>}

        {!hideHeaderActions && !actions && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => push({ type: 'bookmarks' })}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              {t('common.bookmarks')}
            </button>
            <button
              onClick={() => push({ type: 'settings' })}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              {t('common.settings')}
            </button>
          </div>
        )}

        {children}
      </div>
      {toolbar && <div>{toolbar}</div>}
    </header>
  );
}
