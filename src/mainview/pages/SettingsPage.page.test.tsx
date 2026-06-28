import { render } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import i18n from '../i18n';
import { useSettingsStore } from '../stores/settingsStore';
import { useSyncStore } from '../stores/syncStore';

const mockHasKeyFn = mock((): Promise<{ hasKey: boolean }> => Promise.resolve({ hasKey: false }));
const mockSetKeyFn = mock((_key: string): Promise<void> => Promise.resolve());
const mockSyncStatusFn = mock(
  (): Promise<{
    lastSyncTime: null;
    lastSyncedCommit: null;
    isSyncing: boolean;
    remoteRepoURL: string;
    error: null;
  }> =>
    Promise.resolve({
      lastSyncTime: null,
      lastSyncedCommit: null,
      isSyncing: false,
      remoteRepoURL: '',
      error: null,
    }),
);
const mockClearAllFn = mock((): Promise<void> => Promise.resolve());

void mock.module('../api', () => ({
  api: {
    gemini: {
      hasKey: () => mockHasKeyFn(),
      setKey: (key: string) => mockSetKeyFn(key),
    },
    sync: {
      status: () => mockSyncStatusFn(),
      start: mock(() => Promise.resolve({ success: true, commitHash: 'abc123' })),
      setURL: mock(() => Promise.resolve(undefined)),
    },
    storage: {
      clearAll: () => mockClearAllFn(),
    },
  },
  __setRPC: mock(() => {}),
}));

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

import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  beforeEach(() => {
    void i18n.changeLanguage('en-US');
    mockHasKeyFn.mockClear();
    mockSetKeyFn.mockClear();
    mockSyncStatusFn.mockClear();
    mockClearAllFn.mockClear();
    mockHasKeyFn.mockImplementation(() => Promise.resolve({ hasKey: false }));
    mockSyncStatusFn.mockImplementation(() =>
      Promise.resolve({
        lastSyncTime: null,
        lastSyncedCommit: null,
        isSyncing: false,
        remoteRepoURL: '',
        error: null,
      }),
    );
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

  test('renders settings sections', () => {
    const { container } = render(<SettingsPage onBack={() => {}} />);
    expect(container.textContent).toContain('Gemini API Key');
    expect(container.textContent).toContain('Remote Content');
    expect(container.textContent).toContain('Reading Theme');
    expect(container.textContent).toContain('Font Size');
    expect(container.textContent).toContain('Layout');
    expect(container.textContent).toContain('Language');
    expect(container.textContent).toContain('Danger Zone');
    expect(container.textContent).toContain('About');
  });

  test('shows API key input and save button', () => {
    const { container } = render(<SettingsPage onBack={() => {}} />);
    const input = container.querySelector('input[type="password"]');
    expect(input).toBeTruthy();
  });

  test('shows no API key configured when hasApiKey is false', () => {
    const { container } = render(<SettingsPage onBack={() => {}} />);
    expect(container.textContent).toContain('Save');
  });

  test('shows theme options', () => {
    const { container } = render(<SettingsPage onBack={() => {}} />);
    expect(container.textContent).toContain('Dark');
    expect(container.textContent).toContain('OLED');
    expect(container.textContent).toContain('Nord');
    expect(container.textContent).toContain('Sepia');
    expect(container.textContent).toContain('Gruvbox');
    expect(container.textContent).toContain('Light');
    expect(container.textContent).toContain('Solarized');
    expect(container.textContent).toContain('Catppuccin');
  });

  test('shows locale options', () => {
    const { container } = render(<SettingsPage onBack={() => {}} />);
    expect(container.textContent).toContain('English (US)');
    expect(container.textContent).toContain('English (UK)');
    expect(container.textContent).toContain('English (CA)');
    expect(container.textContent).toContain('English (AU)');
    expect(container.textContent).toContain('繁體中文');
  });

  test('calls onBack when back button clicked', () => {
    let called = false;
    const { getByText } = render(
      <SettingsPage
        onBack={() => {
          called = true;
        }}
      />,
    );
    getByText('← Back').click();
    expect(called).toBe(true);
  });
});
