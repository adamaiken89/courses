import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { __setRPC } from '../api';
import { useNotesStore } from './notesStore';

type RPCProxy = { request: Record<string, (p: unknown) => Promise<unknown>> };
const mockResponses = new Map<string, unknown>();

const mockRPC: RPCProxy = {
  request: new Proxy({} as Record<string, (p: unknown) => Promise<unknown>>, {
    get(_, method: string) {
      return (_p: unknown) => {
        const response = mockResponses.get(method);
        if (response === undefined) return Promise.reject(new Error(`No mock for ${method}`));
        return Promise.resolve(response);
      };
    },
  }),
};

beforeAll(() => {
  __setRPC(mockRPC);
});

beforeEach(() => {
  useNotesStore.setState({ byModule: {}, loading: {} });
  mockResponses.clear();
});

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

const aNote = {
  id: 'n1',
  courseID: 'math',
  moduleID: '01',
  content: 'Important note',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('notesStore', () => {
  test('default state', () => {
    const s = useNotesStore.getState();
    expect(s.byModule).toEqual({});
    expect(s.loading).toEqual({});
  });

  test('load populates byModule', async () => {
    mockResponse('getNotes', [aNote]);
    await useNotesStore.getState().load('math', '01');
    expect(useNotesStore.getState().byModule['math:01']).toEqual([aNote]);
    expect(useNotesStore.getState().loading['math:01']).toBe(false);
  });

  test('load sets loading true during fetch', async () => {
    mockResponse('getNotes', [aNote]);
    const promise = useNotesStore.getState().load('math', '01');
    expect(useNotesStore.getState().loading['math:01']).toBe(true);
    await promise;
  });

  test('load handles API error', async () => {
    mockResponses.delete('getNotes');
    await useNotesStore.getState().load('math', '01');
    expect(useNotesStore.getState().byModule['math:01']).toEqual([]);
    expect(useNotesStore.getState().loading['math:01']).toBe(false);
  });

  test('load sets empty array for non-array response', async () => {
    mockResponse('getNotes', null);
    await useNotesStore.getState().load('math', '01');
    expect(useNotesStore.getState().byModule['math:01']).toEqual([]);
  });

  test('add appends note to module array', async () => {
    const newNote = { ...aNote, id: 'n2' };
    mockResponse('addNote', newNote);
    useNotesStore.setState({ byModule: { 'math:01': [aNote] } });
    await useNotesStore.getState().add({
      courseID: 'math',
      moduleID: '01',
      content: 'Another note',
    });
    expect(useNotesStore.getState().byModule['math:01']).toEqual([aNote, newNote]);
  });

  test('add creates new module key when absent', async () => {
    const newNote = { ...aNote, id: 'n2' };
    mockResponse('addNote', newNote);
    await useNotesStore.getState().add({
      courseID: 'math',
      moduleID: '01',
      content: 'First note',
    });
    expect(useNotesStore.getState().byModule['math:01']).toEqual([newNote]);
  });

  test('update replaces content and sets updatedAt', async () => {
    mockResponse('updateNote', { ok: true });
    useNotesStore.setState({ byModule: { 'math:01': [aNote] } });
    await useNotesStore.getState().update('n1', 'Updated content');
    const updated = useNotesStore.getState().byModule['math:01'][0];
    expect(updated.content).toBe('Updated content');
    expect(updated.updatedAt).not.toBe(aNote.updatedAt);
    expect(updated.id).toBe('n1');
  });

  test('update scans all modules for the note', async () => {
    mockResponse('updateNote', { ok: true });
    useNotesStore.setState({
      byModule: {
        'math:01': [aNote],
        'math:02': [{ ...aNote, id: 'n2', moduleID: '02' }],
      },
    });
    await useNotesStore.getState().update('n2', 'Updated');
    expect(useNotesStore.getState().byModule['math:01'][0].content).toBe('Important note');
    expect(useNotesStore.getState().byModule['math:02'][0].content).toBe('Updated');
  });

  test('remove filters note from all modules', async () => {
    mockResponse('deleteNote', { ok: true });
    const note2 = { ...aNote, id: 'n2' };
    useNotesStore.setState({ byModule: { 'math:01': [aNote, note2] } });
    await useNotesStore.getState().remove('n1');
    expect(useNotesStore.getState().byModule['math:01']).toEqual([note2]);
  });

  test('remove no-op on missing id', async () => {
    mockResponse('deleteNote', { ok: true });
    useNotesStore.setState({ byModule: { 'math:01': [aNote] } });
    await useNotesStore.getState().remove('nonexistent');
    expect(useNotesStore.getState().byModule['math:01']).toEqual([aNote]);
  });
});
