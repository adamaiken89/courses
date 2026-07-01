import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../api';
import { showToast } from '../../toast';
import { Button } from '../ui';

export default function DangerSection() {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  const handleClear = async () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 5000);
      return;
    }
    await api.storage.clearAll();
    showToast.success('settings.clearDataSuccess');
    window.location.reload();
  };

  return (
    <section className="bg-red-900/30 border border-red-800 rounded-xl p-6 mb-6">
      <h3 className="text-lg font-semibold mb-2 text-red-400">{t('settings.dangerZone')}</h3>
      <p className="text-sm text-gray-400 mb-4">{t('settings.clearDataDesc')}</p>
      <Button
        variant="danger"
        size="lg"
        onClick={() => {
          void handleClear();
        }}
      >
        {confirming ? t('settings.confirmClearData') : t('settings.clearAllData')}
      </Button>
    </section>
  );
}
