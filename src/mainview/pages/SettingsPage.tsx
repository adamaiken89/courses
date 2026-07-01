import { useTranslation } from 'react-i18next';

import AboutSection from '../components/settings/AboutSection';
import ApiKeySection from '../components/settings/ApiKeySection';
import DangerSection from '../components/settings/DangerSection';
import FontSizeSection from '../components/settings/FontSizeSection';
import LanguageSection from '../components/settings/LanguageSection';
import LayoutSection from '../components/settings/LayoutSection';
import SyncSection from '../components/settings/SyncSection';
import ThemeSection from '../components/settings/ThemeSection';
import PageContent from '../layouts/PageContent';
import PageHeader from '../layouts/PageHeader';
import PageLayout from '../layouts/PageLayout';

interface SettingsPageProps {
  onBack: () => void;
}

export default function SettingsPage({ onBack }: SettingsPageProps) {
  const { t } = useTranslation();
  return (
    <PageLayout>
      <PageHeader onBack={onBack} title={t('common.settings')} hideHeaderActions />
      <PageContent>
        <div className="space-y-8 max-w-lg mx-auto py-8">
          <ApiKeySection />
          <SyncSection />
          <ThemeSection />
          <FontSizeSection />
          <LayoutSection />
          <LanguageSection />
          <DangerSection />
          <AboutSection />
        </div>
      </PageContent>
    </PageLayout>
  );
}
