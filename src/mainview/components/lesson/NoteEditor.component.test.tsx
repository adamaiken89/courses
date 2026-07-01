import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, mock, test } from 'bun:test';

import NoteEditor from './NoteEditor';

const defaultProps = {
  selectedText: 'some highlighted text',
  noteText: '',
  x: 200,
  y: 300,
  onChange: () => {},
  onSave: () => {},
  onCancel: () => {},
};

describe('NoteEditor', () => {
  const user = userEvent.setup();

  test('renders selected text and textarea', () => {
    const { getByTestId, getByText } = render(<NoteEditor {...defaultProps} />);
    expect(getByTestId('note-editor')).toBeInTheDocument();
    expect(getByText((c) => c.includes('some highlighted text'))).toBeInTheDocument();
  });

  test('truncates long selected text', () => {
    const longText = 'a'.repeat(100);
    const { container } = render(<NoteEditor {...defaultProps} selectedText={longText} />);
    expect(container.textContent).toContain('a'.repeat(80) + '...');
  });

  test('typing calls onChange', async () => {
    const onChange = mock(() => {});
    const { container } = render(<NoteEditor {...defaultProps} onChange={onChange} />);
    const textarea = container.querySelector('textarea')!;
    await user.type(textarea, 'my note');
    expect(onChange).toHaveBeenCalled();
  });

  test('save disabled when noteText empty', () => {
    const { getByText } = render(<NoteEditor {...defaultProps} noteText="" />);
    const saveBtn = getByText('Save Note').closest('button');
    expect(saveBtn).toBeDisabled();
  });

  test('save enabled when noteText present', () => {
    const { getByText } = render(<NoteEditor {...defaultProps} noteText="has content" />);
    const saveBtn = getByText('Save Note').closest('button');
    expect(saveBtn).not.toBeDisabled();
  });

  test('save calls onSave', async () => {
    const onSave = mock(() => {});
    const { getByText } = render(
      <NoteEditor {...defaultProps} noteText="my note" onSave={onSave} />,
    );
    await user.click(getByText('Save Note'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  test('cancel calls onCancel', async () => {
    const onCancel = mock(() => {});
    const { getByText } = render(<NoteEditor {...defaultProps} onCancel={onCancel} />);
    await user.click(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
