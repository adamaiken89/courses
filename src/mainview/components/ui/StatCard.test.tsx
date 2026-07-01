import { render } from '@testing-library/react';
import { describe, expect, test } from 'bun:test';

import { StatCard } from './StatCard';

describe('StatCard', () => {
  test('renders label and value', () => {
    const { getByText } = render(<StatCard label="Modules" value={12} />);
    expect(getByText('Modules')).toBeInTheDocument();
    expect(getByText('12')).toBeInTheDocument();
  });

  test('renders suffix when provided', () => {
    const { getByText } = render(<StatCard label="Streak" value={5} suffix="days" />);
    expect(getByText('days')).toBeInTheDocument();
  });

  test('does not render suffix when not provided', () => {
    const { container } = render(<StatCard label="Score" value="85%" />);
    expect(container.querySelector('.ml-1')).toBeNull();
  });

  test('accepts optional color prop', () => {
    const { getByTestId } = render(<StatCard label="Custom" value={42} color="#ff6600" />);
    expect(getByTestId('stat-value')).toHaveStyle({ color: '#ff6600' });
  });
});
