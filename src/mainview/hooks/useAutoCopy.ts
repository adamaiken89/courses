import { useCallback, useEffect, useRef, useState } from 'react';

export function useAutoCopy(handleTextSelection: () => void) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setCopiedWithTimer = useCallback((v: boolean) => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    setCopied(v);
    if (v) {
      copiedTimerRef.current = setTimeout(() => setCopied(false), 700);
    }
  }, []);

  const triggerAutoCopy = useCallback(() => {
    if (autoCopyTimerRef.current) clearTimeout(autoCopyTimerRef.current);
    autoCopyTimerRef.current = setTimeout(() => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount) {
        const text = sel.toString();
        if (text.trim()) {
          void navigator.clipboard.writeText(text);
          setCopiedWithTimer(true);
        }
      }
    }, 500);
  }, [setCopiedWithTimer]);

  const handleTextSelectionWithAutoCopy = useCallback(() => {
    handleTextSelection();
    triggerAutoCopy();
  }, [handleTextSelection, triggerAutoCopy]);

  useEffect(() => {
    return () => {
      if (autoCopyTimerRef.current) clearTimeout(autoCopyTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  return { handleTextSelectionWithAutoCopy, copied, setCopiedWithTimer };
}
