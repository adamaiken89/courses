import mermaid from 'mermaid';
import { useEffect, useRef, useState } from 'react';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

let counter = 0;

export default function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = `mermaid-${++counter}`;
    let cancelled = false;
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) return <pre className="mermaid-error">{error}</pre>;
  if (!svg) return <div className="mermaid-loading">Loading diagram...</div>;
  return <div ref={ref} className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}
