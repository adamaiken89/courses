import { beforeEach, describe, expect, test } from 'bun:test';

import { useLessonUIStore } from './lessonUIStore';

beforeEach(() => {
  useLessonUIStore.setState({ showTools: false, showPomodoro: false, searchCourseOpen: false });
});

describe('lessonUIStore', () => {
  test('default state', () => {
    const s = useLessonUIStore.getState();
    expect(s.showTools).toBe(false);
    expect(s.showPomodoro).toBe(false);
    expect(s.searchCourseOpen).toBe(false);
  });

  test('toggleTools flips showTools', () => {
    useLessonUIStore.getState().toggleTools();
    expect(useLessonUIStore.getState().showTools).toBe(true);
    useLessonUIStore.getState().toggleTools();
    expect(useLessonUIStore.getState().showTools).toBe(false);
  });

  test('togglePomodoro flips showPomodoro', () => {
    useLessonUIStore.getState().togglePomodoro();
    expect(useLessonUIStore.getState().showPomodoro).toBe(true);
    useLessonUIStore.getState().togglePomodoro();
    expect(useLessonUIStore.getState().showPomodoro).toBe(false);
  });

  test('setSearchCourseOpen sets to true', () => {
    useLessonUIStore.getState().setSearchCourseOpen(true);
    expect(useLessonUIStore.getState().searchCourseOpen).toBe(true);
  });

  test('setSearchCourseOpen sets to false', () => {
    useLessonUIStore.getState().setSearchCourseOpen(true);
    useLessonUIStore.getState().setSearchCourseOpen(false);
    expect(useLessonUIStore.getState().searchCourseOpen).toBe(false);
  });
});
