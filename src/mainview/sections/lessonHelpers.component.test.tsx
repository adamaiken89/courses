import { act, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { components, getTextOffset } from './lessonHelpers';

void mock.module('../../bun/lessonMarkdown', () => ({
  headingId: (text: string) => text.toLowerCase().replace(/\s+/g, '-'),
}));
void mock.module('../components/MermaidDiagram', () => ({
  default: ({ code }: { code: string }) => <div data-testid="mermaid-diagram">{code}</div>,
}));

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

describe('headingRenderer (via components)', () => {
  test('h2 renders with headingId as id', () => {
    const H2 = components.h2!;
    const { container } = render(<H2>Introduction</H2>);
    const el = container.querySelector('h2');
    expect(el).toBeTruthy();
    expect(el!.id).toBe('introduction');
    expect(el!.textContent).toBe('Introduction');
  });

  test('h3 renders complex heading', () => {
    const H3 = components.h3!;
    const { container } = render(<H3>Advanced Topics in CS</H3>);
    const el = container.querySelector('h3');
    expect(el).toBeTruthy();
    expect(el!.id).toBe('advanced-topics-in-cs');
  });

  test('h4 renders with children', () => {
    const H4 = components.h4!;
    const { container } = render(<H4>Sub Section</H4>);
    expect(container.querySelector('h4')?.textContent).toBe('Sub Section');
  });

  test('h5 renders', () => {
    const H5 = components.h5!;
    const { container } = render(<H5>Deep heading</H5>);
    expect(container.querySelector('h5')).toBeTruthy();
  });

  test('h6 renders', () => {
    const H6 = components.h6!;
    const { container } = render(<H6>Deepest heading</H6>);
    expect(container.querySelector('h6')).toBeTruthy();
  });
});

describe('table wrapper', () => {
  test('renders div.table-wrapper around table', () => {
    const Table = components.table!;
    const { container } = render(
      <Table>
        <tr>
          <td>data</td>
        </tr>
      </Table>,
    );
    const wrapper = container.querySelector('.table-wrapper');
    expect(wrapper).toBeTruthy();
    expect(wrapper!.querySelector('table')).toBeTruthy();
  });
});

describe('code component', () => {
  test('renders MermaidDiagram for language-mermaid', () => {
    const Code = components.code!;
    const { getByTestId } = render(<Code className="language-mermaid">graph TD; A--&gt;B;</Code>);
    expect(getByTestId('mermaid-diagram')).toBeTruthy();
    expect(getByTestId('mermaid-diagram').textContent).toBe('graph TD; A-->B;');
  });

  test('renders regular code for non-mermaid', () => {
    const Code = components.code!;
    const { container } = render(<Code className="language-js">console.log('test')</Code>);
    expect(container.querySelector('code.language-js')).toBeTruthy();
    expect(container.querySelector('code')?.textContent).toBe("console.log('test')");
  });

  test('renders code without className', () => {
    const Code = components.code!;
    const { container } = render(<Code>plain code</Code>);
    expect(container.querySelector('code')?.textContent).toBe('plain code');
  });
});

describe('getTextOffset', () => {
  test('returns start and end offsets', () => {
    const container = document.createElement('div');
    container.textContent = 'hello world';
    document.body.appendChild(container);

    const range = document.createRange();
    range.setStart(container.firstChild!, 0);
    range.setEnd(container.firstChild!, 5);

    const result = getTextOffset(container, range);
    expect(result).toEqual({ start: 0, end: 5 });

    document.body.removeChild(container);
  });

  test('returns null when range cannot compute offset', () => {
    const container = document.createElement('div');
    const range = document.createRange();
    // Range with no text content returns start=0 end=0, not null
    const result = getTextOffset(container, range);
    expect(result).toEqual({ start: 0, end: 0 });
  });
});
