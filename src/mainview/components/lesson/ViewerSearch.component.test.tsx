import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, mock, test } from 'bun:test';

import ViewerSearch from './ViewerSearch';

const defaultProps = {
  query: '',
  totalMatches: 0,
  currentMatch: 0,
  onQueryChange: () => {},
  onPrev: () => {},
  onNext: () => {},
  onClose: () => {},
};

describe('ViewerSearch', () => {
  const user = userEvent.setup();

  test('renders search input', () => {
    const { getByTestId } = render(<ViewerSearch {...defaultProps} />);
    expect(getByTestId('viewer-search')).toBeInTheDocument();
  });

  test('typing calls onQueryChange', async () => {
    const onQueryChange = mock(() => {});
    const { container } = render(<ViewerSearch {...defaultProps} onQueryChange={onQueryChange} />);
    const input = container.querySelector('input')!;
    await user.type(input, 'keyword');
    expect(onQueryChange).toHaveBeenCalled();
  });

  test('shows match count when query present and total matches >0', () => {
    const { getByText } = render(
      <ViewerSearch {...defaultProps} query="keyword" totalMatches={5} currentMatch={0} />,
    );
    expect(getByText('1 of 5')).toBeInTheDocument();
  });

  test('shows no matches when query present and total matches =0', () => {
    const { getByText } = render(
      <ViewerSearch {...defaultProps} query="keyword" totalMatches={0} currentMatch={0} />,
    );
    expect(getByText('No matches')).toBeInTheDocument();
  });

  test('Enter key calls onNext', async () => {
    const onNext = mock(() => {});
    const { container } = render(
      <ViewerSearch {...defaultProps} query="k" totalMatches={3} onNext={onNext} />,
    );
    const input = container.querySelector('input')!;
    await user.type(input, '{Enter}');
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test('Shift+Enter calls onPrev', async () => {
    const onPrev = mock(() => {});
    const { container } = render(
      <ViewerSearch {...defaultProps} query="k" totalMatches={3} onPrev={onPrev} />,
    );
    const input = container.querySelector('input')!;
    await user.type(input, '{Shift>}{Enter}');
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  test('Escape key calls onClose', async () => {
    const onClose = mock(() => {});
    const { container } = render(<ViewerSearch {...defaultProps} onClose={onClose} />);
    const input = container.querySelector('input')!;
    await user.type(input, '{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('renders next/prev buttons when matches exist', () => {
    const { getByText } = render(<ViewerSearch {...defaultProps} query="k" totalMatches={3} />);
    expect(getByText('↑')).toBeInTheDocument();
    expect(getByText('↓')).toBeInTheDocument();
  });

  test('clicking next calls onNext', async () => {
    const onNext = mock(() => {});
    const { getByText } = render(
      <ViewerSearch {...defaultProps} query="k" totalMatches={3} onNext={onNext} />,
    );
    await user.click(getByText('↓'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test('clicking prev calls onPrev', async () => {
    const onPrev = mock(() => {});
    const { getByText } = render(
      <ViewerSearch {...defaultProps} query="k" totalMatches={3} onPrev={onPrev} />,
    );
    await user.click(getByText('↑'));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  test('close button calls onClose', async () => {
    const onClose = mock(() => {});
    const { getByText } = render(<ViewerSearch {...defaultProps} onClose={onClose} />);
    await user.click(getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
