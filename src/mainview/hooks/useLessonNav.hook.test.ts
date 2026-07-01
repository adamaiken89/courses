import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'bun:test';

import type { Course, ModuleMeta } from '../../bun/types';
import { useViewStore } from '../stores/viewStore';
import { useLessonNav } from './useLessonNav';

const mockModules: ModuleMeta[] = [
  { id: 'm1', name: 'Module 1', timeHours: 1, prerequisites: [], topics: ['a'] },
  { id: 'm2', name: 'Module 2', timeHours: 2, prerequisites: [], topics: ['b'] },
  { id: 'm3', name: 'Module 3', timeHours: 3, prerequisites: [], topics: ['c'] },
];

const course: Course = {
  id: 'test',
  course: 'Test',
  displayName: 'Test',
  timeBudgetHours: 10,
  targetLevel: 'beginner',
  domain: 'test',
  prerequisites: [],
  learningObjectives: [],
  modules: mockModules,
};

beforeEach(() => {
  useViewStore.setState(useViewStore.getInitialState());
});

describe('useLessonNav', () => {
  test('first module has hasPrev=false, hasNext=true', () => {
    const { result } = renderHook(() => useLessonNav(course, mockModules[0]));
    expect(result.current.hasPrev).toBe(false);
    expect(result.current.hasNext).toBe(true);
  });

  test('middle module has hasPrev=true, hasNext=true', () => {
    const { result } = renderHook(() => useLessonNav(course, mockModules[1]));
    expect(result.current.hasPrev).toBe(true);
    expect(result.current.hasNext).toBe(true);
  });

  test('last module has hasPrev=true, hasNext=false', () => {
    const { result } = renderHook(() => useLessonNav(course, mockModules[2]));
    expect(result.current.hasPrev).toBe(true);
    expect(result.current.hasNext).toBe(false);
  });

  test('single module course both false', () => {
    const c: Course = { ...course, modules: [mockModules[0]] };
    const { result } = renderHook(() => useLessonNav(c, mockModules[0]));
    expect(result.current.hasPrev).toBe(false);
    expect(result.current.hasNext).toBe(false);
  });

  test('goPrev pushes previous module view', () => {
    const { result } = renderHook(() => useLessonNav(course, mockModules[1]));
    act(() => result.current.goPrev());
    const views = useViewStore.getState().views;
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ type: 'lesson', course });
    expect('module' in views[0] ? (views[0] as { module: ModuleMeta }).module.id : null).toBe('m1');
  });

  test('goNext pushes next module view', () => {
    const { result } = renderHook(() => useLessonNav(course, mockModules[0]));
    act(() => result.current.goNext());
    const views = useViewStore.getState().views;
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ type: 'lesson', course });
    expect('module' in views[0] ? (views[0] as { module: ModuleMeta }).module.id : null).toBe('m2');
  });

  test('goPrev does nothing when at first module', () => {
    const { result } = renderHook(() => useLessonNav(course, mockModules[0]));
    act(() => result.current.goPrev());
    expect(useViewStore.getState().views).toEqual([]);
  });

  test('goNext does nothing when at last module', () => {
    const { result } = renderHook(() => useLessonNav(course, mockModules[2]));
    act(() => result.current.goNext());
    expect(useViewStore.getState().views).toEqual([]);
  });
});
