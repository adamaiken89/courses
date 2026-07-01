import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '../../stores/settingsStore';
import { selectableCardVariants } from '../ui';

const WIDTH_OPTIONS = [
  { id: 'narrow' as const, labelKey: 'settings.narrowLayout', descKey: 'settings.narrowDesc' },
  {
    id: 'standard' as const,
    labelKey: 'settings.standardLayout',
    descKey: 'settings.standardDesc',
  },
  { id: 'wide' as const, labelKey: 'settings.wideLayout', descKey: 'settings.wideDesc' },
];

const TRANSITION_OPTIONS = [
  {
    id: 'none' as const,
    labelKey: 'settings.transitionNone',
    descKey: 'settings.transitionNoneDesc',
  },
  {
    id: 'flip' as const,
    labelKey: 'settings.transitionFlip',
    descKey: 'settings.transitionFlipDesc',
  },
  {
    id: 'slide' as const,
    labelKey: 'settings.transitionSlide',
    descKey: 'settings.transitionSlideDesc',
  },
  {
    id: 'fade' as const,
    labelKey: 'settings.transitionFade',
    descKey: 'settings.transitionFadeDesc',
  },
];

export default function LayoutSection() {
  const { t } = useTranslation();
  const contentWidth = useSettingsStore((s) => s.contentWidth);
  const setContentWidth = useSettingsStore((s) => s.setContentWidth);
  const transitionStyle = useSettingsStore((s) => s.transitionStyle);
  const setTransitionStyle = useSettingsStore((s) => s.setTransitionStyle);

  return (
    <>
      <section className="bg-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">{t('settings.layout')}</h3>
        <div className="flex gap-2">
          {WIDTH_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setContentWidth(opt.id)}
              className={`flex-1 ${selectableCardVariants({ selected: contentWidth === opt.id })}`}
            >
              <div className="text-sm font-medium">{t(opt.labelKey)}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{t(opt.descKey)}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">{t('settings.pageTransition')}</h3>
        <div className="grid grid-cols-2 gap-3">
          {TRANSITION_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTransitionStyle(opt.id)}
              className={`text-left ${selectableCardVariants({ selected: transitionStyle === opt.id })}`}
            >
              <div className="text-sm font-medium">{t(opt.labelKey)}</div>
              <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{t(opt.descKey)}</div>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
