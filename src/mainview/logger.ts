const isDev = import.meta.env.DEV;

function log(level: string, ...args: unknown[]) {
  const prefix = isDev ? `[${level.toUpperCase()}]` : '';
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log; // eslint-disable-line no-console
  fn(prefix, ...args);
}

export const logger = {
  info: (msg: unknown, ...args: unknown[]) => log('info', msg, ...args),
  warn: (msg: unknown, ...args: unknown[]) => log('warn', msg, ...args),
  error: (msg: unknown, ...args: unknown[]) => log('error', msg, ...args),
  debug: (msg: unknown, ...args: unknown[]) => {
    if (isDev) log('debug', msg, ...args);
  },
};
