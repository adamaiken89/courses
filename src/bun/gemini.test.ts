import { beforeEach, describe, expect, mock, test } from 'bun:test';

let mockKey: string | null = null;

mock.module('./storage', () => ({
  getGeminiKey: () => mockKey,
  setGeminiKey: (key: string) => {
    mockKey = key;
  },
}));

mock.module('./logger', () => ({
  logger: {
    info: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
  },
}));

const originalFetch = globalThis.fetch;

type Gemini = typeof import('./gemini');
let gemini: Gemini;

beforeEach(() => {
  mockKey = null;
  globalThis.fetch = originalFetch;
});

describe('hasAPIKey', () => {
  test('returns false when no key set', async () => {
    gemini = await import('./gemini');
    expect(gemini.hasAPIKey()).toBe(false);
  });

  test('returns true when key set', async () => {
    mockKey = 'test-key';
    gemini = await import('./gemini');
    expect(gemini.hasAPIKey()).toBe(true);
  });
});

describe('setAPIKey', () => {
  test('saves key via storage', async () => {
    gemini = await import('./gemini');
    gemini.setAPIKey('my-key');
    expect(mockKey).toBe('my-key');
  });
});

describe('askGemini', () => {
  test('throws when no API key set', async () => {
    gemini = await import('./gemini');
    expect(gemini.askGemini('question', 'context')).rejects.toThrow('No API key set');
  });

  test('returns text on successful API call', async () => {
    mockKey = 'valid-key';
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'Here is the answer' }] } }],
          }),
      } as Response),
    ) as unknown as typeof globalThis.fetch;

    gemini = await import('./gemini');
    const result = await gemini.askGemini('what is x?', 'context about x');
    expect(result).toBe('Here is the answer');
  });

  test('throws on API error response', async () => {
    mockKey = 'valid-key';
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      } as Response),
    ) as unknown as typeof globalThis.fetch;

    gemini = await import('./gemini');
    expect(gemini.askGemini('q', 'c')).rejects.toThrow('API error (400)');
  });

  test('throws on empty response', async () => {
    mockKey = 'valid-key';
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ candidates: [] }),
      } as Response),
    ) as unknown as typeof globalThis.fetch;

    gemini = await import('./gemini');
    expect(gemini.askGemini('q', 'c')).rejects.toThrow('Invalid response from API');
  });

  test('throws on missing text in response', async () => {
    mockKey = 'valid-key';
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{}] } }],
          }),
      } as Response),
    ) as unknown as typeof globalThis.fetch;

    gemini = await import('./gemini');
    expect(gemini.askGemini('q', 'c')).rejects.toThrow('Invalid response from API');
  });

  test('throws on network failure', async () => {
    mockKey = 'valid-key';
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Network error')),
    ) as unknown as typeof globalThis.fetch;

    gemini = await import('./gemini');
    expect(gemini.askGemini('q', 'c')).rejects.toThrow('Network error');
  });
});
