import { beforeEach, describe, expect, test } from 'bun:test';

import { useLessonStore } from './lessonStore';

beforeEach(() => {
  useLessonStore.setState({ showTools: false, showPomodoro: false, searchCourseOpen: false });
});

describe('lessonStore UI slice', () => {
  test('default state', () => {
    const s = useLessonStore.getState();
    expect(s.showTools).toBe(false);
    expect(s.showPomodoro).toBe(false);
    expect(s.searchCourseOpen).toBe(false);
  });

  test('toggleTools flips showTools', () => {
    useLessonStore.getState().toggleTools();
    expect(useLessonStore.getState().showTools).toBe(true);
    useLessonStore.getState().toggleTools();
    expect(useLessonStore.getState().showTools).toBe(false);
  });

  test('togglePomodoro flips showPomodoro', () => {
    useLessonStore.getState().togglePomodoro();
    expect(useLessonStore.getState().showPomodoro).toBe(true);
    useLessonStore.getState().togglePomodoro();
    expect(useLessonStore.getState().showPomodoro).toBe(false);
  });

  test('setSearchCourseOpen sets to true', () => {
    useLessonStore.getState().setSearchCourseOpen(true);
    expect(useLessonStore.getState().searchCourseOpen).toBe(true);
  });

  test('setSearchCourseOpen sets to false', () => {
    useLessonStore.getState().setSearchCourseOpen(true);
    useLessonStore.getState().setSearchCourseOpen(false);
    expect(useLessonStore.getState().searchCourseOpen).toBe(false);
  });
});
