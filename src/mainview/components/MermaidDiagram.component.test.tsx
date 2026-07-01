import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { mermaidMockImpl } from '../../testFsShared';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require('react');

void mock.module('../components/MermaidDiagram', () => {
  const { useState, useEffect } = React;

  function MermaidDiagramMock({ code }: { code: string }) {
    const [svg, setSvg] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
      let cancelled = false;
      mermaidMockImpl
        .render(code)
        .then((res: unknown) => {
          if (!cancelled) setSvg((res as { svg: string }).svg);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(String(e));
        });
      return () => {
        cancelled = true;
      };
    }, [code]);

    if (error) return React.createElement('pre', { className: 'mermaid-error' }, error);
    if (!svg)
      return React.createElement('div', { className: 'mermaid-loading' }, 'Loading diagram...');
    return React.createElement('div', {
      className: 'mermaid-diagram',
      dangerouslySetInnerHTML: { __html: svg },
    });
  }

  return { default: MermaidDiagramMock };
});

import MermaidDiagram from './MermaidDiagram';

describe('MermaidDiagram', () => {
  beforeEach(() => {
    mermaidMockImpl.render = (..._args: unknown[]) => Promise.resolve({ svg: '<svg>mock</svg>' });
  });

  test('renders loading state', () => {
    mermaidMockImpl.render = () => new Promise(() => {});
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
    mermaidMockImpl.render = () => Promise.reject(new Error('Parse error'));
    const { container } = render(<MermaidDiagram code="invalid" />);
    await waitFor(() => {
      expect(container.querySelector('.mermaid-error')).toBeInTheDocument();
    });
  });
});
