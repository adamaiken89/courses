export interface Shortcut {
  key: string;
  id: string;
  scope: 'global' | 'lesson' | 'lessonToolbar';
  /** Requires Cmd/Ctrl */
  mod?: boolean;
}

export const SHORTCUTS: Shortcut[] = [
  // ── Global ──
  { key: 'k', id: 'search', scope: 'global', mod: true },

  // ── Lesson toolbar ──
  { key: '-', id: 'decFontSize', scope: 'lessonToolbar' },
  { key: '=', id: 'incFontSize', scope: 'lessonToolbar' },
  { key: 't', id: 'cycleTheme', scope: 'lessonToolbar' },
  { key: 'w', id: 'toggleWidth', scope: 'lessonToolbar' },
  { key: 'b', id: 'bookmark', scope: 'lessonToolbar' },
  { key: 'f', id: 'focusMode', scope: 'lessonToolbar' },
  { key: 'p', id: 'pomodoro', scope: 'lessonToolbar' },
  { key: 'l', id: 'tools', scope: 'lessonToolbar' },
  { key: 'c', id: 'reviewCards', scope: 'lessonToolbar' },
  { key: 'q', id: 'quiz', scope: 'lessonToolbar' },
  { key: 'r', id: 'review', scope: 'lessonToolbar' },
  { key: 'x', id: 'cycleTransition', scope: 'lessonToolbar' },

  // ── Lesson content ──
  { key: 'ArrowLeft', id: 'prevModule', scope: 'lesson' },
  { key: 'ArrowRight', id: 'nextModule', scope: 'lesson' },
  { key: 'ArrowUp', id: 'scrollUp', scope: 'lesson' },
  { key: 'ArrowDown', id: 'scrollDown', scope: 'lesson' },
  { key: 's', id: 'toggleSections', scope: 'lesson' },
  { key: 'f', id: 'findInPage', scope: 'lesson', mod: true },
  { key: 'g', id: 'courseSearch', scope: 'lesson', mod: true },
];

const ID_TO_SHORTCUT: Record<string, Shortcut> = {};
for (const s of SHORTCUTS) {
  ID_TO_SHORTCUT[s.id] = s;
}

export function shortcutKey(id: string): string | undefined {
  return ID_TO_SHORTCUT[id]?.key;
}

// Duplicate detection — check SHORTCUTS array for overlapping keys
const KEY_SCOPE = new Map<string, string[]>();
for (const s of SHORTCUTS) {
  const key = s.mod ? `mod+${s.key}` : s.key;
  const existing = KEY_SCOPE.get(key) ?? [];
  existing.push(`${s.id} (${s.scope})`);
  KEY_SCOPE.set(key, existing);
}
const dupes: string[] = [];
for (const [key, entries] of KEY_SCOPE) {
  if (entries.length > 1) {
    dupes.push(`  ${key}: ${entries.join(', ')}`);
  }
}

if (dupes.length > 0) {
  console.warn(`[shortcuts] Duplicate key bindings:\n${dupes.join('\n')}`);
}
