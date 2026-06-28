import { fireEvent, render } from '@testing-library/react';
import { describe, expect, mock,test } from 'bun:test';

import SelectionToolbar from './SelectionToolbar';

const defaultProps = {
  x: 200,
  y: 300,
  selectionTop: 280,
  selectedText: 'selected text',
  onSelectColor: () => {},
  onOpenNote: () => {},
  onCreateCard: () => {},
  onCopy: () => {},
};

describe('SelectionToolbar', () => {
  test('renders all action buttons', () => {
    const { getByText } = render(<SelectionToolbar {...defaultProps} />);
    expect(getByText('Add Note')).toBeInTheDocument();
    expect(getByText('Create Card')).toBeInTheDocument();
    expect(getByText('Copy')).toBeInTheDocument();
  });

  test('clicking note button calls onOpenNote', () => {
    const onOpenNote = mock(() => {});
    const { getByText } = render(<SelectionToolbar {...defaultProps} onOpenNote={onOpenNote} />);
    fireEvent.click(getByText('Add Note'));
    expect(onOpenNote).toHaveBeenCalledTimes(1);
  });

  test('clicking create card calls onCreateCard', () => {
    const onCreateCard = mock(() => {});
    const { getByText } = render(<SelectionToolbar {...defaultProps} onCreateCard={onCreateCard} />);
    fireEvent.click(getByText('Create Card'));
    expect(onCreateCard).toHaveBeenCalledTimes(1);
  });

  test('clicking copy calls onCopy with selected text', () => {
    const onCopy = mock(() => {});
    const { getByText } = render(<SelectionToolbar {...defaultProps} onCopy={onCopy} />);
    fireEvent.click(getByText('Copy'));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith('selected text');
  });

  test('copy button shows copied state', () => {
    const { getByText } = render(<SelectionToolbar {...defaultProps} />);
    fireEvent.click(getByText('Copy'));
    expect(getByText('Copied!')).toBeInTheDocument();
  });

  test('copy button does nothing without selectedText', () => {
    const onCopy = mock(() => {});
    const { getByText } = render(<SelectionToolbar {...defaultProps} selectedText={undefined} onCopy={onCopy} />);
    fireEvent.click(getByText('Copy'));
    expect(onCopy).not.toHaveBeenCalled();
  });

  test('clicking inactive color calls onSelectColor', () => {
    const onSelectColor = mock(() => {});
    const { container } = render(<SelectionToolbar {...defaultProps} onSelectColor={onSelectColor} />);
    const yellowBtn = container.querySelector('button[title="yellow"]');
    expect(yellowBtn).toBeTruthy();
    fireEvent.click(yellowBtn!);
    expect(onSelectColor).toHaveBeenCalledWith('yellow');
  });

  test('clicking active color calls onDeleteHighlight', () => {
    const onDeleteHighlight = mock(() => {});
    const onSelectColor = mock(() => {});
    const { container } = render(
      <SelectionToolbar {...defaultProps} onDeleteHighlight={onDeleteHighlight} onSelectColor={onSelectColor} activeHighlightColor="yellow" />,
    );
    const yellowBtn = container.querySelector('button[title="yellow"]');
    expect(yellowBtn).toBeTruthy();
    fireEvent.click(yellowBtn!);
    expect(onDeleteHighlight).toHaveBeenCalledTimes(1);
    expect(onSelectColor).not.toHaveBeenCalled();
  });
});
