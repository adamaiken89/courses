import { beforeAll } from 'bun:test';

import { __setRPC } from './api';

const mockResponses = new Map<string, unknown>();

export const mockRPC = {
  request: new Proxy({} as Record<string, (p: unknown) => Promise<unknown>>, {
    get(_, method: string) {
      return (_p: unknown) => {
        const response = mockResponses.get(method);
        if (!mockResponses.has(method)) return Promise.reject(new Error(`No mock for ${method}`));
        if (response instanceof Error) return Promise.reject(response);
        return Promise.resolve(response);
      };
    },
  }),
};

export function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

export function clearMocks() {
  mockResponses.clear();
}

export function deleteMock(method: string) {
  mockResponses.delete(method);
}

export function hasMock(method: string): boolean {
  return mockResponses.has(method);
}

export function setupRPC(rpc?: { request: Record<string, (p: unknown) => Promise<unknown>> }) {
  beforeAll(() => __setRPC(rpc ?? mockRPC));
}
