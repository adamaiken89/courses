import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { TransitionStyle } from '../../stores/settingsStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../ui';

function WidthTransitionControl() {
  const { t } = useTranslation();
  const contentWidth = useSettingsStore((s) => s.contentWidth);
  const setContentWidth = useSettingsStore((s) => s.setContentWidth);
  const transitionStyle = useSettingsStore((s) => s.transitionStyle);
  const setTransitionStyle = useSettingsStore((s) => s.setTransitionStyle);

  const cycleTransition = useCallback(() => {
    const order: TransitionStyle[] = ['none', 'flip', 'slide', 'fade'];
    const next = order[(order.indexOf(transitionStyle) + 1) % order.length];
    setTransitionStyle(next);
  }, [transitionStyle, setTransitionStyle]);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          const order: Array<'narrow' | 'standard' | 'wide'> = ['narrow', 'standard', 'wide'];
          const next = order[(order.indexOf(contentWidth) + 1) % order.length];
          setContentWidth(next);
        }}
        title={t('lesson.toggleWideMode')}
      >
        {contentWidth === 'narrow'
          ? t('lesson.narrow')
          : contentWidth === 'standard'
            ? t('lesson.standard')
            : t('lesson.wide')}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={cycleTransition}
        title={`${t('settings.pageTransition')}: ${t(`settings.transition${transitionStyle.charAt(0).toUpperCase() + transitionStyle.slice(1)}`)}`}
      >
        {transitionStyle === 'none'
          ? t('settings.transitionNone')
          : transitionStyle === 'flip'
            ? `↻ ${t('settings.transitionFlip')}`
            : transitionStyle === 'slide'
              ? `→ ${t('settings.transitionSlide')}`
              : `◦ ${t('settings.transitionFade')}`}
      </Button>
    </>
  );
}

export default WidthTransitionControl;
