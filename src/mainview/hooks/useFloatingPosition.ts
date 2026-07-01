import { useEffect, useRef, useState } from 'react';

export function useFloatingPosition(x: number, y: number, selectionTop: number) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    if (!menuRef.current) return;
    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const gap = 8;

    let top = y + gap;
    const belowEnd = top + menuRect.height + gap;
    if (belowEnd > viewportH) {
      top = selectionTop - menuRect.height - gap;
    }
    if (top < gap) top = gap;

    let left = x;
    const halfW = menuRect.width / 2;
    if (left - halfW < gap) left = gap + halfW;
    if (left + halfW > viewportW - gap) left = viewportW - gap - halfW;

    setPosition({ x: left, y: top });
  }, [x, y, selectionTop]);

  return { menuRef, position };
}
