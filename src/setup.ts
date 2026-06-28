import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect, mock } from 'bun:test';
import { Window } from 'happy-dom';

import { fsMockState } from './test-fs-shared';

expect.extend(jestDomMatchers);

void mock.module('fs', () => fsMockState);



class MockElectroview {
  constructor(_config: Record<string, unknown>) {}
  static defineRPC(_config: Record<string, unknown>) {
    return {
      setTransport: () => {},
      setRequestHandler: () => {},
      request: new Proxy((() => Promise.resolve(null)) as (...args: unknown[]) => unknown, {
        get: (_t: (...args: unknown[]) => unknown, method: string) => (_params: unknown) => {
          if (
            method.endsWith('List') ||
            method.endsWith('Notes') ||
            method.endsWith('Highlights') ||
            method.endsWith('Bookmarks') ||
            method.endsWith('Cards') ||
            method.endsWith('Sessions') ||
            method.endsWith('Modules')
          )
            return Promise.resolve([]);
          if (method.endsWith('Deck')) return Promise.resolve({ cards: {} });
          return Promise.resolve(null);
        },
      }),
      send: () => {},
      proxy: { request: {}, send: {} },
      addMessageListener: () => {},
      removeMessageListener: () => {},
    };
  }
}
void mock.module('electrobun/view', () => ({ Electroview: MockElectroview }));

/* eslint-disable no-console */
const _warn = console.warn;
const _error = console.error;
const _log = console.log;
console.warn = () => {};
console.error = () => {};
console.log = () => {};
console.warn = _warn;
console.error = _error;
console.log = _log;
interface TestGlobals {
  IS_REACT_ACT_ENVIRONMENT: boolean;
  window: Window & typeof globalThis;
  document: Document;
  self: Window & typeof globalThis;
  top: Window & typeof globalThis;
  parent: Window & typeof globalThis;
  location: Location;
  navigator: Navigator;
  localStorage: Storage;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
  setInterval: typeof globalThis.setInterval;
  clearInterval: typeof globalThis.clearInterval;
  URL: typeof globalThis.URL;
  URLSearchParams: typeof globalThis.URLSearchParams;
  crypto: Crypto;
  Event: typeof Event;
  MutationObserver: typeof globalThis.MutationObserver;
  customElements: CustomElementRegistry;
  IntersectionObserver: { new (): { observe(): void; unobserve(): void; disconnect(): void } };
  Range: typeof Range;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (id: number) => void;
  fetch: (...args: unknown[]) => Promise<unknown>;
  NodeFilter: {
    SHOW_ALL: number;
    SHOW_ELEMENT: number;
    SHOW_TEXT: number;
    SHOW_COMMENT: number;
    SHOW_DOCUMENT: number;
    SHOW_DOCUMENT_TYPE: number;
    SHOW_DOCUMENT_FRAGMENT: number;
    SHOW_PROCESSING_INSTRUCTION: number;
    SHOW_CDATA_SECTION: number;
    SHOW_ENTITY_REFERENCE: number;
    SHOW_ENTITY: number;
    FILTER_ACCEPT: number;
    FILTER_REJECT: number;
    FILTER_SKIP: number;
  };
}

const g: TestGlobals = globalThis as unknown as TestGlobals;

g.IS_REACT_ACT_ENVIRONMENT = true;

const win = new Window() as unknown as Window & typeof globalThis;

g.window = win;
g.document = win.document;
g.self = win;
g.top = win;
g.parent = win;
g.Event = win.Event as typeof Event;
g.location = win.location;
g.navigator = win.navigator;
g.localStorage = win.localStorage;
g.setTimeout = win.setTimeout;
g.clearTimeout = win.clearTimeout;
g.setInterval = win.setInterval;
g.clearInterval = win.clearInterval;
g.URL = win.URL;
g.URLSearchParams = win.URLSearchParams;
g.crypto = win.crypto;
g.MutationObserver = win.MutationObserver;
g.customElements = win.customElements;
g.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 16);
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
g.fetch = async () => new Promise(() => {});
class MockRange {
  commonAncestorContainer: HTMLElement;
  constructor() {
    this.commonAncestorContainer = document.body;
  }
  getBoundingClientRect() {
    return {
      top: 0, left: 0, right: 0, bottom: 0,
      width: 0, height: 0, x: 0, y: 0,
      toJSON: () => ({}),
    };
  }
  setStart() {}
  setEnd() {}
  selectNodeContents() {}
  deleteContents() {}
  extractContents() {
    return document.createDocumentFragment();
  }
  cloneContents() {
    return document.createDocumentFragment();
  }
  insertNode() {}
  surroundContents() {}
  toString() { return ''; }
  cloneRange() { return new MockRange(); }
  collapse() {}
}
g.Range = MockRange as unknown as typeof Range;

g.NodeFilter = {
  SHOW_ALL: -1,
  SHOW_ELEMENT: 1,
  SHOW_TEXT: 4,
  SHOW_COMMENT: 128,
  SHOW_DOCUMENT: 256,
  SHOW_DOCUMENT_TYPE: 512,
  SHOW_DOCUMENT_FRAGMENT: 1024,
  SHOW_PROCESSING_INSTRUCTION: 64,
  SHOW_CDATA_SECTION: 8,
  SHOW_ENTITY_REFERENCE: 16,
  SHOW_ENTITY: 32,
  FILTER_ACCEPT: 1,
  FILTER_REJECT: 2,
  FILTER_SKIP: 3,
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});
