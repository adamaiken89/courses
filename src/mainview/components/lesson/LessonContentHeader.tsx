import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import type { PluggableList } from 'unified';

import type { MetaField } from '../../../bun/lessonMarkdown';
import { components } from '../../sections/lessonHelpers';

interface LessonContentHeaderProps {
  h1: string;
  meta: MetaField[];
  rehypePlugins: PluggableList;
}

export default function LessonContentHeader({ h1, meta, rehypePlugins }: LessonContentHeaderProps) {
  return (
    <>
      {h1 && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {`# ${h1}`}
        </ReactMarkdown>
      )}
      {meta.length > 0 && (
        <div className="lesson-meta">
          {meta.map((m, i) => {
            const isDesc = m.key === 'description';
            return (
              <span key={m.key} style={isDesc ? { flexBasis: '100%' } : undefined}>
                {!isDesc && i > 0 && <span className="meta-divider" />}
                <span className={`meta-item${isDesc ? ' meta-description' : ''}`}>
                  <span className="meta-icon">{m.icon}</span>
                  <span className="meta-label">{m.label}</span>
                  <span className="meta-value">{m.value}</span>
                </span>
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}
