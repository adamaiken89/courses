import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface PageHeaderProps {
  onBack?: () => void;
  backLabel?: string;
  title?: string;
  center?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export default function PageHeader({
  onBack,
  backLabel,
  title,
  center,
  actions,
  children,
}: PageHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
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

      {center && <div className="flex-1 flex justify-center">{center}</div>}

      {actions && <div className="flex items-center gap-1.5">{actions}</div>}

      {children}
    </header>
  );
}
