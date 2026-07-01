import { act, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

void mock.module('../../bun/lessonMarkdown', () => ({
  headingId: (text: string) => text.toLowerCase().replace(/\s+/g, '-'),
}));

import { components } from './lessonHelpers';

let clipboardText = '';
const originalWriteText = navigator.clipboard.writeText;

beforeEach(() => {
  clipboardText = '';
  Object.assign(navigator.clipboard, {
    writeText: mock(async (text: string) => {
      clipboardText = text;
    }),
  });
});

afterEach(() => {
  Object.assign(navigator.clipboard, { writeText: originalWriteText });
});

describe('CodeBlockWithCopy (via components.pre)', () => {
  const user = userEvent.setup();

  test('renders code block with copy button', () => {
    const Pre = components.pre!;
    const { container } = render(
      <Pre>
        <code className="language-js">console.log('hello')</code>
      </Pre>,
    );
    const btn = container.querySelector('button');
    expect(btn).toBeTruthy();
    expect(btn!.textContent!.length).toBeGreaterThan(0);
    expect(btn).toHaveClass('opacity-0');
  });

  test('copy button has group-hover styling for visibility on hover', () => {
    const Pre = components.pre!;
    const { container } = render(
      <Pre>
        <code className="language-js">console.log('hello')</code>
      </Pre>,
    );
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('opacity-0');
    expect(btn.className).toContain('group-hover:opacity-100');
  });

  test('clicking copy writes code text to clipboard', async () => {
    const Pre = components.pre!;
    const { container } = render(
      <Pre>
        <code className="language-js">console.log('hello')</code>
      </Pre>,
    );
    const btn = container.querySelector('button')!;
    await user.click(btn);
    await waitFor(() => {
      expect(clipboardText).toBe("console.log('hello')");
    });
  });

  test('copy button shows different text after click (copied state)', async () => {
    const Pre = components.pre!;
    const { container } = render(
      <Pre>
        <code className="language-js">console.log('hello')</code>
      </Pre>,
    );
    const btn = container.querySelector('button')!;
    const textBefore = btn.textContent;
    await user.click(btn);
    await waitFor(() => {
      expect(btn.textContent).not.toBe(textBefore);
    });
  });

  test('copied feedback reverts after timeout', async () => {
    const Pre = components.pre!;
    const { container } = render(
      <Pre>
        <code className="language-js">console.log('hello')</code>
      </Pre>,
    );
    const btn = container.querySelector('button')!;
    const originalText = btn.textContent;
    await user.click(btn);
    await waitFor(() => {
      expect(btn.textContent).not.toBe(originalText);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1600));
    });
    expect(btn.textContent).toBe(originalText);
  });

  test('copy handles multi-line code blocks', async () => {
    const Pre = components.pre!;
    const { container } = render(
      <Pre>
        <code className="language-py">{'def foo():\n  return 42'}</code>
      </Pre>,
    );
    const btn = container.querySelector('button')!;
    await user.click(btn);
    await waitFor(() => {
      expect(clipboardText).toBe('def foo():\n  return 42');
    });
  });
});
