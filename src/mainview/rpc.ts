import { Electroview } from 'electrobun/view';

import type { AppSchema } from '../bun/rpcSchema';

const rpcInstance = Electroview.defineRPC<AppSchema>({
  maxRequestTime: 30000,
  handlers: {
    requests: {},
    messages: {},
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof window !== 'undefined' && (window as any).__electrobun) {
  new Electroview({ rpc: rpcInstance });
}

export const rpc = rpcInstance;
