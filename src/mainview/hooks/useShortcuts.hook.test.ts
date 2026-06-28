import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { useShortcuts } from './useShortcuts';

function createMockEvent(overrides: {
  key?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  target?: EventTarget | null;
}): KeyboardEvent {
  return {
    key: overrides.key ?? 'a',
    metaKey: overrides.metaKey ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
    target: overrides.target ?? document.body,
    preventDefault: mock(() => {}),
    stopPropagation: mock(() => {}),
    type: 'keydown',
    bubbles: false,
    cancelable: true,
    defaultPrevented: false,
    composed: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    cancelBubble: false,
    returnValue: true,
    srcElement: null,
    currentTarget: null,
    eventPhase: 0,
    timeStamp: Date.now(),
    NONE: 0,
    CAPTURING_PHASE: 1,
    AT_TARGET: 2,
    BUBBLING_PHASE: 3,
    stopImmediatePropagation: mock(() => {}),
    initEvent: mock(() => {}),
    initKeyboardEvent: mock(() => {}),
    charCode: 0,
    keyCode: 0,
    which: 0,
    locale: '',
    location: 0,
    code: '',
    getModifierState: mock(() => false),
  } as unknown as KeyboardEvent;
}

describe('useShortcuts', () => {
  const handlers: Record<string, () => void> = {};
  let addEventSpy: ReturnType<typeof mock>;
  let removeEventSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    handlers.search = mock(() => {});
    handlers.toggleSections = mock(() => {});
    handlers.decFontSize = mock(() => {});

    addEventSpy = mock((_type: string, _listener: EventListener) => {});
    removeEventSpy = mock((_type: string, _listener: EventListener) => {});
    window.addEventListener = addEventSpy;
    window.removeEventListener = removeEventSpy;
  });

  test('registers keydown listener on mount', () => {
    renderHook(() => useShortcuts('lesson', handlers));
    expect(addEventSpy).toHaveBeenCalledTimes(1);
    expect(addEventSpy.mock.calls[0][0]).toBe('keydown');
  });

  test('removes listener on unmount', () => {
    const { unmount } = renderHook(() => useShortcuts('lesson', handlers));
    unmount();
    expect(removeEventSpy).toHaveBeenCalledTimes(1);
    expect(removeEventSpy.mock.calls[0][0]).toBe('keydown');
  });

  test('fires correct handler for matching non-mod shortcut', () => {
    let capturedListener: EventListener | null = null;
    window.addEventListener = mock((_type: string, listener: EventListener) => {
      capturedListener = listener;
    }) as typeof window.addEventListener;

    renderHook(() => useShortcuts('lessonToolbar', handlers));

    const event = createMockEvent({ key: '-' });
    capturedListener!(event);

    expect(handlers.decFontSize).toHaveBeenCalledTimes(1);
  });

  test('fires handler for mod+key shortcut', () => {
    let capturedListener: EventListener | null = null;
    window.addEventListener = mock((_type: string, listener: EventListener) => {
      capturedListener = listener;
    }) as typeof window.addEventListener;

    renderHook(() => useShortcuts('global', handlers));

    const event = createMockEvent({ key: 'k', metaKey: true });
    capturedListener!(event);

    expect(handlers.search).toHaveBeenCalledTimes(1);
  });

  test('prevents default on matched shortcut', () => {
    let capturedListener: EventListener | null = null;
    window.addEventListener = mock((_type: string, listener: EventListener) => {
      capturedListener = listener;
    }) as typeof window.addEventListener;

    renderHook(() => useShortcuts('lessonToolbar', handlers));

    const event = createMockEvent({ key: '-' });
    capturedListener!(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  test('does not fire handler for non-matching key', () => {
    let capturedListener: EventListener | null = null;
    window.addEventListener = mock((_type: string, listener: EventListener) => {
      capturedListener = listener;
    }) as typeof window.addEventListener;

    renderHook(() => useShortcuts('lessonToolbar', handlers));

    const event = createMockEvent({ key: 'z' });
    capturedListener!(event);

    expect(handlers.decFontSize).not.toHaveBeenCalled();
  });

  test('skips handler when focused on input element', () => {
    let capturedListener: EventListener | null = null;
    window.addEventListener = mock((_type: string, listener: EventListener) => {
      capturedListener = listener;
    }) as typeof window.addEventListener;

    renderHook(() => useShortcuts('lessonToolbar', handlers));

    const input = document.createElement('input');
    const event = createMockEvent({ key: '-', target: input });
    capturedListener!(event);

    expect(handlers.decFontSize).not.toHaveBeenCalled();
  });

  test('skips handler when focused on textarea element', () => {
    let capturedListener: EventListener | null = null;
    window.addEventListener = mock((_type: string, listener: EventListener) => {
      capturedListener = listener;
    }) as typeof window.addEventListener;

    renderHook(() => useShortcuts('lessonToolbar', handlers));

    const textarea = document.createElement('textarea');
    const event = createMockEvent({ key: '-', target: textarea });
    capturedListener!(event);

    expect(handlers.decFontSize).not.toHaveBeenCalled();
  });

  test('skips handler when focused on contentEditable element', () => {
    let capturedListener: EventListener | null = null;
    window.addEventListener = mock((_type: string, listener: EventListener) => {
      capturedListener = listener;
    }) as typeof window.addEventListener;

    renderHook(() => useShortcuts('lessonToolbar', handlers));

    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    const event = createMockEvent({ key: '-', target: editable });
    capturedListener!(event);

    expect(handlers.decFontSize).not.toHaveBeenCalled();
  });
});
