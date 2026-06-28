import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, mock,test } from 'bun:test';

import { usePomodoroStore } from '../stores/pomodoroStore';
import PomodoroTimer from './PomodoroTimer';

beforeEach(() => {
  usePomodoroStore.setState({ status: 'idle', mode: 'focus', remaining: 1500, completedSessions: 0 });
});

describe('PomodoroTimer (full)', () => {
  test('idle state shows preset buttons', () => {
    const { getByText } = render(<PomodoroTimer />);
    expect(getByText('Focus')).toBeInTheDocument();
    expect(getByText('Short Break')).toBeInTheDocument();
    expect(getByText('Long Break')).toBeInTheDocument();
  });

  test('clicking preset starts timer', () => {
    const start = mock(() => {});
    usePomodoroStore.setState({ start });
    const { getByText } = render(<PomodoroTimer />);
    fireEvent.click(getByText('Focus'));
    expect(start).toHaveBeenCalledWith('focus');
  });

  test('running state shows remaining time', () => {
    usePomodoroStore.setState({ status: 'running', remaining: 1250 });
    const { getByText } = render(<PomodoroTimer />);
    expect(getByText('20:50')).toBeInTheDocument();
  });

  test('running state shows pause button', () => {
    usePomodoroStore.setState({ status: 'running' });
    const { getByText } = render(<PomodoroTimer />);
    expect(getByText('Pause')).toBeInTheDocument();
  });

  test('paused state shows resume button', () => {
    usePomodoroStore.setState({ status: 'paused' });
    const { getByText } = render(<PomodoroTimer />);
    expect(getByText('Resume')).toBeInTheDocument();
  });

  test('finished state shows focus button', () => {
    usePomodoroStore.setState({ status: 'finished' });
    const { getAllByText } = render(<PomodoroTimer />);
    expect(getAllByText('Focus').length).toBeGreaterThanOrEqual(1);
  });

  test('stop button visible in non-idle states', () => {
    usePomodoroStore.setState({ status: 'running' });
    const { getByText } = render(<PomodoroTimer />);
    expect(getByText('Stop')).toBeInTheDocument();
  });

  test('calls stop on click', () => {
    const stop = mock(() => {});
    usePomodoroStore.setState({ status: 'running', stop });
    const { getByText } = render(<PomodoroTimer />);
    fireEvent.click(getByText('Stop'));
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test('shows session count', () => {
    usePomodoroStore.setState({ status: 'idle', completedSessions: 3 });
    const { getByText } = render(<PomodoroTimer />);
    expect(getByText(/3/)).toBeInTheDocument();
  });
});

describe('PomodoroTimer (compact)', () => {
  test('idle compact shows focus button', () => {
    const { getByText } = render(<PomodoroTimer compact />);
    expect(getByText('Focus')).toBeInTheDocument();
  });

  test('running compact shows time and pause', () => {
    usePomodoroStore.setState({ status: 'running', remaining: 900 });
    const { getByText } = render(<PomodoroTimer compact />);
    expect(getByText('15:00')).toBeInTheDocument();
    expect(getByText('Pause')).toBeInTheDocument();
  });

  test('paused compact shows resume', () => {
    usePomodoroStore.setState({ status: 'paused' });
    const { getByText } = render(<PomodoroTimer compact />);
    expect(getByText('Resume')).toBeInTheDocument();
  });
});
