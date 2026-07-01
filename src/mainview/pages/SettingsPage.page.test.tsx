import { act, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import i18n from '../i18n';
import { useSettingsStore } from '../stores/settingsStore';
import { useSyncStore } from '../stores/syncStore';
import { clearMocks, mockResponse, setupRPC } from '../testUtils';

void mock.module('../layouts/PageLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-layout">{children}</div>
  ),
}));
void mock.module('../layouts/PageHeader', () => ({
  default: ({ onBack, title }: { onBack?: () => void; title?: string }) => (
    <header data-testid="page-header">
      {title && <h1>{title}</h1>}
      {onBack && <button onClick={onBack}>← Back</button>}
    </header>
  ),
}));
void mock.module('../layouts/PageContent', () => ({
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <main data-testid="page-content" className={className}>
      {children}
    </main>
  ),
}));

setupRPC();

import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  const user = userEvent.setup();
  beforeEach(() => {
    void i18n.changeLanguage('en-US');
    clearMocks();
    mockResponse('geminiHasKey', { hasKey: false });
    mockResponse('getSyncStatus', {
      lastSyncTime: null,
      lastSyncedCommit: null,
      isSyncing: false,
      remoteRepoURL: '',
      error: null,
    });
    useSettingsStore.setState({
      hasApiKey: false,
      fontSize: 16,
      theme: 'dark',
      contentWidth: 'standard',
      locale: 'en-US',
    });
    useSyncStore.setState({
      lastSyncTime: null,
      lastSyncedCommit: null,
      isSyncing: false,
      remoteRepoURL: '',
      error: null,
    });
  });

  test('renders settings sections', async () => {
    const { container } = render(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Gemini API Key');
    });
    expect(container.textContent).toContain('Remote Content');
    expect(container.textContent).toContain('Reading Theme');
    expect(container.textContent).toContain('Font Size');
    expect(container.textContent).toContain('Layout');
    expect(container.textContent).toContain('Language');
    expect(container.textContent).toContain('Danger Zone');
    expect(container.textContent).toContain('About');
  });

  test('shows API key input field', async () => {
    const { container } = render(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(container.querySelector('input[type="password"]')).toBeTruthy();
    });
  });

  test('shows configured indicator when hasApiKey is true', async () => {
    useSettingsStore.setState({ hasApiKey: true });
    const { container } = render(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(container.textContent).toContain('configured');
    });
  });

  test('increments font size when A+ clicked', async () => {
    const { getByText } = render(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(getByText('A+')).toBeTruthy();
    });
    await user.click(getByText('A+'));
    expect(useSettingsStore.getState().fontSize).toBe(18);
  });

  test('decrements font size when A- clicked', async () => {
    const { getByText } = render(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(getByText('A-')).toBeTruthy();
    });
    await user.click(getByText('A-'));
    expect(useSettingsStore.getState().fontSize).toBe(14);
  });

  test('selects theme when theme card clicked', async () => {
    const { getByText } = render(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(getByText('Light')).toBeTruthy();
    });
    await user.click(getByText('Light'));
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  test('calls onBack when back button clicked', async () => {
    let called = false;
    let renderResult!: ReturnType<typeof render>;
    await act(async () => {
      renderResult = render(
        <SettingsPage
          onBack={() => {
            called = true;
          }}
        />,
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    renderResult.getByText('← Back').click();
    expect(called).toBe(true);
  });

  test('clear data button shows confirm on first click', async () => {
    const { getByText } = render(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(getByText('Clear All Data')).toBeInTheDocument();
    });
    await user.click(getByText('Clear All Data'));
    expect(getByText('Are you sure? Click again to confirm.')).toBeInTheDocument();
  });

  test('saves API key when save clicked', async () => {
    mockResponse('geminiSetKey', {});
    const { container, getByText } = render(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(container.querySelector('input[type="password"]')).toBeTruthy();
    });
    const input = container.querySelector('input[type="password"]')!;
    await user.type(input, 'test-key-123');
    await user.click(getByText('Save'));
    await waitFor(() => {
      expect(getByText('Saved!')).toBeInTheDocument();
    });
  });

  test('selects language when locale button clicked', async () => {
    const { getByText } = render(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(getByText('繁體中文')).toBeInTheDocument();
    });
    await user.click(getByText('繁體中文'));
    expect(useSettingsStore.getState().locale).toBe('zh-TW');
  });

  test('selects layout width', async () => {
    const { getByText } = render(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(getByText('Narrow')).toBeInTheDocument();
    });
    await user.click(getByText('Narrow'));
    expect(useSettingsStore.getState().contentWidth).toBe('narrow');
    await user.click(getByText('Wide'));
    expect(useSettingsStore.getState().contentWidth).toBe('wide');
  });

  test('selects transition style', async () => {
    const { getByText } = render(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(getByText('Slide')).toBeInTheDocument();
    });
    await user.click(getByText('Slide'));
    expect(useSettingsStore.getState().transitionStyle).toBe('slide');
  });

  test('shows sync error when present', async () => {
    useSyncStore.setState({ error: 'Repository not found' });
    const { container } = render(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Repository not found');
    });
  });

  test('pre-fills repo URL from sync store', async () => {
    useSyncStore.setState({ remoteRepoURL: 'https://github.com/user/repo' });
    const { container } = render(<SettingsPage onBack={() => {}} />);
    await waitFor(() => {
      const inputs = container.querySelectorAll('input[type="text"]');
      const urlInput = Array.from(inputs).find((i) =>
        i.getAttribute('placeholder')?.includes('github'),
      );
      expect(urlInput).toHaveValue('https://github.com/user/repo');
    });
  });
});
