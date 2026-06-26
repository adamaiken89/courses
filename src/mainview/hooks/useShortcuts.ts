import { useEffect, useRef } from 'react';
import { SHORTCUTS } from '../shortcuts';
import type { Shortcut } from '../shortcuts';

type ShortcutHandlers = Record<string, () => void>;

export function useShortcuts(scope: Shortcut['scope'], handlers: ShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const scopeShortcuts = SHORTCUTS.filter((s) => s.scope === scope);

    const listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return;

      const hasMod = e.metaKey || e.ctrlKey;
      const lowerKey = e.key.toLowerCase();

      for (const s of scopeShortcuts) {
        if (s.mod && !hasMod) continue;
        if (!s.mod && hasMod) continue;

        const keyMatch = s.key.length === 1 ? lowerKey === s.key.toLowerCase() : e.key === s.key;
        if (!keyMatch) continue;

        e.preventDefault();
        handlersRef.current[s.id]?.();
        return;
      }
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [scope]);
}
