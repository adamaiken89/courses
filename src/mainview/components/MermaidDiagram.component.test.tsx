import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

const mockMermaid: { render: (...args: unknown[]) => Promise<{ svg: string }> } = {
  render: () => Promise.resolve({ svg: '<svg>mock</svg>' }),
};

void mock.module('mermaid', () => ({
  default: {
    initialize: mock(() => {}),
    render: (...args: unknown[]) => mockMermaid.render(...args),
  },
}));

import MermaidDiagram from './MermaidDiagram';

describe('MermaidDiagram', () => {
  beforeEach(() => {
    mockMermaid.render = () => Promise.resolve({ svg: '<svg>mock</svg>' });
  });

  test('renders loading state', () => {
    mockMermaid.render = () => new Promise(() => {});
    const { getByText } = render(<MermaidDiagram code="graph TD; A-->B;" />);
    expect(getByText('Loading diagram...')).toBeInTheDocument();
  });

  test('renders SVG on success', async () => {
    const { container } = render(<MermaidDiagram code="graph TD; A-->B;" />);
    await waitFor(() => {
      expect(container.querySelector('.mermaid-diagram')).toBeInTheDocument();
    });
  });

  test('renders error on failure', async () => {
    mockMermaid.render = () => Promise.reject(new Error('Parse error'));
    const { container } = render(<MermaidDiagram code="invalid" />);
    await waitFor(() => {
      expect(container.querySelector('.mermaid-error')).toBeInTheDocument();
    });
  });
});
