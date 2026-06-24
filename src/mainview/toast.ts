import { toast as sonnerToast, type ExternalToast } from 'sonner';
import i18n from './i18n';

function t(key: string, values?: Record<string, unknown>): string {
  return i18n.t(key, values) as string;
}

type Opts = ExternalToast & { values?: Record<string, unknown> };

export const showToast = {
  success(key: string, opts?: Opts) {
    return sonnerToast.success(t(key, opts?.values), opts);
  },
  error(key: string, opts?: Opts) {
    return sonnerToast.error(t(key, opts?.values), { duration: 6000, ...opts });
  },
  info(key: string, opts?: Opts) {
    return sonnerToast.info(t(key, opts?.values), opts);
  },
  warning(key: string, opts?: Opts) {
    return sonnerToast.warning(t(key, opts?.values), opts);
  },
  promise<T>(promise: Promise<T>, msgs: { loading: string; success: string; error: string }) {
    return sonnerToast.promise(promise, {
      loading: t(msgs.loading),
      success: t(msgs.success),
      error: () => t(msgs.error),
    });
  },
};
