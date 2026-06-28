import { beforeEach, describe, expect, test } from 'bun:test';

import { usePomodoroStore } from './pomodoroStore';

beforeEach(() => {
  localStorage.clear();
  usePomodoroStore.setState(usePomodoroStore.getInitialState());
});

describe('pomodoroStore', () => {
  test('default state', () => {
    const s = usePomodoroStore.getState();
    expect(s.status).toBe('idle');
    expect(s.mode).toBe('focus');
    expect(s.remaining).toBe(25 * 60);
    expect(s.completedSessions).toBe(0);
  });

  test('start sets running status and remaining for focus mode', () => {
    usePomodoroStore.getState().start('focus');
    const s = usePomodoroStore.getState();
    expect(s.status).toBe('running');
    expect(s.mode).toBe('focus');
    expect(s.remaining).toBe(25 * 60);
    expect(s.intervalId).not.toBeNull();
    clearInterval(s.intervalId!);
  });

  test('start sets remaining for short break', () => {
    usePomodoroStore.getState().start('shortBreak');
    const s = usePomodoroStore.getState();
    expect(s.remaining).toBe(5 * 60);
    clearInterval(s.intervalId!);
  });

  test('start sets remaining for long break', () => {
    usePomodoroStore.getState().start('longBreak');
    const s = usePomodoroStore.getState();
    expect(s.remaining).toBe(15 * 60);
    clearInterval(s.intervalId!);
  });

  test('pause sets status to paused and clears interval', () => {
    usePomodoroStore.getState().start('focus');
    usePomodoroStore.getState().pause();
    const s = usePomodoroStore.getState();
    expect(s.status).toBe('paused');
    expect(s.intervalId).toBeNull();
  });

  test('stop resets to idle', () => {
    usePomodoroStore.getState().start('focus');
    usePomodoroStore.getState().stop();
    const s = usePomodoroStore.getState();
    expect(s.status).toBe('idle');
    expect(s.mode).toBe('focus');
    expect(s.remaining).toBe(25 * 60);
  });

  test('reset clears interval and resets state', () => {
    usePomodoroStore.getState().start('focus');
    usePomodoroStore.getState().reset();
    const s = usePomodoroStore.getState();
    expect(s.status).toBe('idle');
    expect(s.intervalId).toBeNull();
  });
});
