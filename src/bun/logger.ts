const isDev = process.env.NODE_ENV !== 'production';

function log(level: string, ...args: unknown[]) {
  const prefix = isDev ? `[${level.toUpperCase()}]` : '';
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    fn(prefix, args[0]);
  } else if (args.length >= 2 && typeof args[0] === 'object' && args[0] !== null) {
    fn(prefix, args[0], args[1]);
  } else {
    fn(prefix, ...args);
  }
}

export const logger = {
  info: (msg: unknown, ...args: unknown[]) => log('info', msg, ...args),
  warn: (msg: unknown, ...args: unknown[]) => log('warn', msg, ...args),
  error: (msg: unknown, ...args: unknown[]) => log('error', msg, ...args),
  debug: (msg: unknown, ...args: unknown[]) => {
    if (isDev) log('debug', msg, ...args);
  },
};
