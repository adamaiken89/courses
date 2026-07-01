import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'bun:test';

import { useLessonViewStore } from '../../stores/lessonViewStore';
import { clearMocks, mockResponse, setupRPC } from '../../testUtils';

setupRPC();

import AITab from './AITab';

describe('AITab', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    clearMocks();
    useLessonViewStore.setState({ content: 'lesson content' });
  });

  test('renders textarea and button', () => {
    const { getByPlaceholderText, getByText } = render(<AITab />);
    expect(getByPlaceholderText('Ask a question about this lesson...')).toBeInTheDocument();
    expect(getByText('Ask')).toBeInTheDocument();
  });

  test('button disabled when textarea empty', () => {
    const { getByText } = render(<AITab />);
    expect(getByText('Ask')).toBeDisabled();
  });

  test('shows response after asking', async () => {
    mockResponse('geminiAsk', 'AI response text');
    const { getByPlaceholderText, getByText, findByText } = render(<AITab />);
    const textarea = getByPlaceholderText('Ask a question about this lesson...');
    await user.type(textarea, 'What is X?');
    await user.click(getByText('Ask'));
    expect(await findByText('AI response text')).toBeInTheDocument();
  });

  test('shows error on failure', async () => {
    mockResponse('geminiAsk', new Error('API error'));
    const { getByPlaceholderText, getByText, findByText } = render(<AITab />);
    const textarea = getByPlaceholderText('Ask a question about this lesson...');
    await user.type(textarea, 'What is X?');
    await user.click(getByText('Ask'));
    expect(await findByText('Error: Check Gemini API key in Settings.')).toBeInTheDocument();
  });
});
