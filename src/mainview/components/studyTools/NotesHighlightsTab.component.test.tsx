import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { useHighlightsStore } from '../../stores/highlightsStore';
import { useLessonViewStore } from '../../stores/lessonViewStore';
import { useNotesStore } from '../../stores/notesStore';
import { useViewStore } from '../../stores/viewStore';
import NotesHighlightsTab from './NotesHighlightsTab';

const mockHighlight = {
  id: 'h1',
  courseID: 'math',
  moduleID: '01',
  selectedText: 'important concept',
  color: '#ff0',
  startOffset: 10,
  endOffset: 28,
  createdAt: '2024-01-01T00:00:00Z',
};

const mockNote = {
  id: 'n1',
  courseID: 'math',
  moduleID: '01',
  content: 'my note content',
  sectionID: null,
  highlightID: null,
  createdAt: '2024-01-02T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
};

const mockNoteLinked = {
  id: 'n2',
  courseID: 'math',
  moduleID: '01',
  content: 'linked note',
  sectionID: 'intro',
  highlightID: 'h1',
  createdAt: '2024-01-03T00:00:00Z',
  updatedAt: '2024-01-03T00:00:00Z',
};

describe('NotesHighlightsTab', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    useLessonViewStore.setState({
      content: '',
      sections: [],
      contentRef: { current: null },
      scrollToSection: () => {},
    });
    useViewStore.setState({
      views: [
        {
          type: 'lesson',
          course: {
            id: 'math',
            course: 'math',
            displayName: 'Math',
            timeBudgetHours: 0,
            targetLevel: '',
            domain: '',
            prerequisites: [],
            learningObjectives: [],
            modules: [],
          },
          module: { id: '01', name: '', timeHours: 0, prerequisites: [], topics: [] },
        },
      ],
    });
    useNotesStore.setState({
      byModule: {},
      loading: {},
      load: mock(() => Promise.resolve()),
      add: mock(() => Promise.resolve()),
      update: mock(() => Promise.resolve()),
      remove: mock(() => Promise.resolve()),
    });
    useHighlightsStore.setState({
      byModule: {},
      remove: mock(() => Promise.resolve()),
    });
  });

  test('renders empty state', async () => {
    const { findByText } = render(<NotesHighlightsTab />);
    expect(
      await findByText('No annotations yet. Select text to highlight or add a note.'),
    ).toBeInTheDocument();
  });

  test('renders loading state', () => {
    useNotesStore.setState({ loading: { 'math:01': true } });
    const { getByText } = render(<NotesHighlightsTab />);
    expect(getByText('Loading notes...')).toBeInTheDocument();
  });

  test('renders highlights from store', async () => {
    useHighlightsStore.setState({ byModule: { 'math:01': [mockHighlight] } });
    const { findByText, getByText } = render(<NotesHighlightsTab />);
    expect(await findByText('important concept')).toBeInTheDocument();
    expect(getByText('10\u201328')).toBeInTheDocument();
  });

  test('renders notes from store', async () => {
    useNotesStore.setState({ byModule: { 'math:01': [mockNote] } });
    const { findByText } = render(<NotesHighlightsTab />);
    expect(await findByText('my note content')).toBeInTheDocument();
  });

  test('renders note with linked highlight', async () => {
    useHighlightsStore.setState({ byModule: { 'math:01': [mockHighlight] } });
    useNotesStore.setState({ byModule: { 'math:01': [mockNoteLinked] } });
    const { findAllByText } = render(<NotesHighlightsTab />);
    const matches = await findAllByText(/important concept/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  test('adds note when save clicked', async () => {
    const add = mock(() => Promise.resolve());
    useNotesStore.setState({ add });
    const { container, findByText } = render(<NotesHighlightsTab />);
    const textarea = container.querySelector('textarea')!;
    await user.type(textarea, 'new test note');
    await user.click(await findByText('Save Note'));
    expect(add).toHaveBeenCalledWith({
      courseID: 'math',
      moduleID: '01',
      content: 'new test note',
      sectionID: undefined,
    });
  });

  test('save note button disabled when textarea empty', () => {
    const { getByText } = render(<NotesHighlightsTab />);
    expect(getByText('Save Note')).toBeDisabled();
  });

  test('deletes highlight', async () => {
    const remove = mock(() => Promise.resolve());
    useHighlightsStore.setState({ byModule: { 'math:01': [mockHighlight] }, remove });
    const { findByText, getByText } = render(<NotesHighlightsTab />);
    expect(await findByText('important concept')).toBeInTheDocument();
    await user.click(getByText('Delete'));
    expect(remove).toHaveBeenCalledWith('h1');
  });

  test('deletes note', async () => {
    const remove = mock(() => Promise.resolve());
    useNotesStore.setState({ byModule: { 'math:01': [mockNote] }, remove });
    const { findByText, getByText } = render(<NotesHighlightsTab />);
    expect(await findByText('my note content')).toBeInTheDocument();
    await user.click(getByText('Delete'));
    expect(remove).toHaveBeenCalledWith('n1');
  });

  test('edits a note', async () => {
    const update = mock(() => Promise.resolve());
    useNotesStore.setState({ byModule: { 'math:01': [mockNote] }, update });
    const { findByText, getByText, container } = render(<NotesHighlightsTab />);
    expect(await findByText('my note content')).toBeInTheDocument();
    await user.click(getByText('Edit'));
    const textareas = container.querySelectorAll('textarea');
    expect(textareas[1]).toHaveValue('my note content');
    expect(getByText('Cancel')).toBeInTheDocument();
    await user.click(getByText('Cancel'));
    expect(getByText('Edit')).toBeInTheDocument();
  });

  test('save edit updates note', async () => {
    const update = mock(() => Promise.resolve());
    useNotesStore.setState({ byModule: { 'math:01': [mockNote] }, update });
    const { findByText, container } = render(<NotesHighlightsTab />);
    expect(await findByText('my note content')).toBeInTheDocument();
    await user.click(await findByText('Edit'));
    const textareas = container.querySelectorAll('textarea');
    await user.clear(textareas[1]);
    await user.type(textareas[1], 'updated content');
    await user.click(await findByText('Save'));
    expect(update).toHaveBeenCalledWith('n1', 'updated content');
  });
});
