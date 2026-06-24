import { create } from 'zustand';
import { getStored, store } from './storage-utils';

export type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';
type PomodoroStatus = 'idle' | 'running' | 'paused' | 'finished';

const PRESETS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

interface PomodoroState {
  status: PomodoroStatus;
  mode: PomodoroMode;
  remaining: number;
  intervalId: ReturnType<typeof setInterval> | null;
  completedSessions: number;
  start: (mode: PomodoroMode) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  status: 'idle',
  mode: 'focus',
  remaining: PRESETS.focus,
  intervalId: null,
  completedSessions: getStored('coursereader-pomodoro-count', 0),

  start: (mode) => {
    const existing = get().intervalId;
    if (existing) clearInterval(existing);
    const remaining = PRESETS[mode];
    const id = setInterval(() => {
      const state = get();
      if (state.remaining <= 1) {
        clearInterval(state.intervalId!);
        const count = getStored('coursereader-pomodoro-count', 0) + 1;
        store('coursereader-pomodoro-count', count);
        set({ status: 'finished', remaining: 0, intervalId: null, completedSessions: count });
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(mode === 'focus' ? 'Focus session complete!' : 'Break over!');
        }
        return;
      }
      set({ remaining: state.remaining - 1 });
    }, 1000);
    set({ status: 'running', mode, remaining, intervalId: id });
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  },

  pause: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);
    set({ status: 'paused', intervalId: null });
  },

  resume: () => {
    const id = setInterval(() => {
      const state = get();
      if (state.remaining <= 1) {
        clearInterval(state.intervalId!);
        const count = getStored('coursereader-pomodoro-count', 0) + 1;
        store('coursereader-pomodoro-count', count);
        set({ status: 'finished', remaining: 0, intervalId: null, completedSessions: count });
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(state.mode === 'focus' ? 'Focus session complete!' : 'Break over!');
        }
        return;
      }
      set({ remaining: state.remaining - 1 });
    }, 1000);
    set({ status: 'running', intervalId: id });
  },

  stop: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);
    set({ status: 'idle', remaining: PRESETS.focus, intervalId: null, mode: 'focus' });
  },

  reset: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);
    set({ status: 'idle', remaining: PRESETS.focus, intervalId: null, mode: 'focus' });
  },
}));
