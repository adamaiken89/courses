import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, mock, test } from 'bun:test';

import NotePopover from './NotePopover';

const makeNote = (overrides = {}) => ({
  id: 'n1',
  courseID: 'math',
  moduleID: '01',
  content: 'my note content',
  highlightID: null,
  sectionID: 'intro',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...overrides,
});

const defaultProps = {
  note: makeNote(),
  x: 200,
  y: 300,
  onClose: () => {},
};

describe('NotePopover', () => {
  const user = userEvent.setup();

  test('renders note content', () => {
    const { getByTestId, getByText } = render(<NotePopover {...defaultProps} />);
    expect(getByTestId('note-popover')).toBeInTheDocument();
    expect(getByText((c) => c.includes('Notes'))).toBeInTheDocument();
    expect(getByText('my note content')).toBeInTheDocument();
  });

  test('Escape key calls onClose', async () => {
    const onClose = mock(() => {});
    render(<NotePopover {...defaultProps} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('mousedown outside calls onClose', async () => {
    const onClose = mock(() => {});
    render(<NotePopover {...defaultProps} onClose={onClose} />);
    await user.click(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('mousedown inside does not call onClose', async () => {
    const onClose = mock(() => {});
    const { getByTestId } = render(<NotePopover {...defaultProps} onClose={onClose} />);
    await user.click(getByTestId('note-popover'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
