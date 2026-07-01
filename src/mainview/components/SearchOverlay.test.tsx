import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

const mockResults = [
  {
    type: 'lesson',
    courseID: 'math',
    courseName: 'Mathematics',
    moduleID: '01',
    moduleName: 'Algebra',
    sectionID: null,
    sectionTitle: null,
    snippet: 'x + y = z',
  },
  {
    type: 'lesson',
    courseID: 'phys',
    courseName: 'Physics',
    moduleID: '02',
    moduleName: 'Mechanics',
    sectionID: 's2',
    sectionTitle: 'Newton Laws',
    snippet: 'F = ma',
  },
];

import { useCourseStore } from '../stores/courseStore';
import { clearMocks, mockResponse, setupRPC } from '../testUtils';
import SearchOverlay from './SearchOverlay';

setupRPC();

const baseCourse = {
  timeBudgetHours: 0,
  targetLevel: 'beginner',
  domain: 'general',
  prerequisites: [],
  learningObjectives: [],
  modules: [],
};

const mathCourse = { ...baseCourse, id: 'math', course: 'math', displayName: 'Mathematics' };
const physCourse = { ...baseCourse, id: 'phys', course: 'phys', displayName: 'Physics' };

beforeEach(() => {
  clearMocks();
  mockResponse('search', mockResults);
  useCourseStore.setState({
    courses: [mathCourse, physCourse],
    loaded: true,
    loading: false,
  });
});

describe('SearchOverlay', () => {
  const user = userEvent.setup();

  test('renders search input and ESC button', () => {
    const { getByPlaceholderText, getByText } = render(
      <SearchOverlay onClose={() => {}} onNavigate={() => {}} />,
    );
    expect(getByPlaceholderText('Search across courses...')).toBeInTheDocument();
    expect(getByText('ESC')).toBeInTheDocument();
  });

  test('shows all courses hint when no filters', () => {
    const { getByText } = render(<SearchOverlay onClose={() => {}} onNavigate={() => {}} />);
    expect(getByText('No course filter — searching all courses')).toBeInTheDocument();
  });

  test('typing triggers search and shows results', async () => {
    const { getByPlaceholderText, findByText } = render(
      <SearchOverlay onClose={() => {}} onNavigate={() => {}} />,
    );
    await user.type(getByPlaceholderText('Search across courses...'), 'test');
    expect(await findByText('x + y = z', {}, { timeout: 1000 })).toBeInTheDocument();
  });

  test('shows results count', async () => {
    const { getByPlaceholderText, findByText } = render(
      <SearchOverlay onClose={() => {}} onNavigate={() => {}} />,
    );
    await user.type(getByPlaceholderText('Search across courses...'), 'test');
    expect(await findByText('Results (2)', {}, { timeout: 1000 })).toBeInTheDocument();
  });

  test('shows grouped course headers', async () => {
    const { getByPlaceholderText, findByText } = render(
      <SearchOverlay onClose={() => {}} onNavigate={() => {}} />,
    );
    await user.type(getByPlaceholderText('Search across courses...'), 'test');
    expect(await findByText('Mathematics', {}, { timeout: 1000 })).toBeInTheDocument();
    expect(await findByText('Physics', {}, { timeout: 1000 })).toBeInTheDocument();
  });

  test('adds course filter chip', async () => {
    const { getByText, findByPlaceholderText, queryByText, container } = render(
      <SearchOverlay onClose={() => {}} onNavigate={() => {}} />,
    );
    expect(getByText('No course filter — searching all courses')).toBeInTheDocument();

    await user.click(getByText('+ Add course'));
    const filterInput = await findByPlaceholderText('Filter courses...');
    await user.type(filterInput, 'Math');

    const mathOption = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Mathematics' && b.closest('[class*="absolute"]'),
    );
    expect(mathOption).toBeTruthy();
    await user.click(mathOption!);

    expect(queryByText('No course filter — searching all courses')).toBeNull();
    const chips = container.querySelectorAll('[class*="rounded-full"]');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('Mathematics');
  });

  test('keyboard navigation selects result and navigates on enter', async () => {
    const onNavigate = mock(() => {});
    const onClose = mock(() => {});

    const { getByPlaceholderText, findByText } = render(
      <SearchOverlay onClose={onClose} onNavigate={onNavigate} />,
    );

    const input = getByPlaceholderText('Search across courses...');
    await user.type(input, 'test');

    await findByText('x + y = z', {}, { timeout: 1000 });

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onNavigate).toHaveBeenCalledWith('math', '01', 'test', null);

    await new Promise((r) => setTimeout(r, 250));
    expect(onClose).toHaveBeenCalled();
  });

  test('removes course filter chip', async () => {
    const { getByText } = render(
      <SearchOverlay
        initialCourseIDs={['math']}
        initialCourseNames={['Mathematics']}
        onClose={() => {}}
        onNavigate={() => {}}
      />,
    );

    expect(getByText('Mathematics')).toBeInTheDocument();
    const closeBtn = getByText('✕');
    await user.click(closeBtn);
    expect(getByText('No course filter — searching all courses')).toBeInTheDocument();
  });
});
