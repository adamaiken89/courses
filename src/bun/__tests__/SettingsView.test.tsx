import { describe, expect, test, afterEach } from 'bun:test';
import { render, waitFor, act } from '@testing-library/react';
import SettingsView from '../../mainview/components/views/SettingsView';
import { mockFetch, restoreFetch } from './mock-fetch';

const defaultProps = { onBack: () => {} };

afterEach(restoreFetch);

describe('SettingsView snapshots', () => {
  test('initial render (checking key status)', async () => {
    mockFetch({ '/gemini/key': { hasKey: false } });
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(<SettingsView {...defaultProps} />));
    });
    expect(container!.innerHTML).toMatchSnapshot();
  });

  test('no API key configured', async () => {
    mockFetch({ '/gemini/key': { hasKey: false } });
    const { container } = render(<SettingsView {...defaultProps} />);
    await waitFor(() => expect(container.textContent).toContain('Gemini API'));
    expect(container.innerHTML).toMatchSnapshot();
  });

  test('API key configured', async () => {
    mockFetch({ '/gemini/key': { hasKey: true } });
    const { container } = render(<SettingsView {...defaultProps} />);
    await waitFor(() => expect(container.textContent).toContain('API key is configured'));
    expect(container.innerHTML).toMatchSnapshot();
  });
});
