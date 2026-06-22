import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

import { api } from '../api';
import { useBookmarks } from '../hooks/useBookmarks';
import { useHighlights } from '../hooks/useHighlights';
import { useSettingsStore } from '../stores/settingsStore';
import { Section } from './sidebar-types';
import { toggleVariants } from './ui';
import StudyTools from './StudyTools';

import type { Theme } from "../stores/settingsStore";
interface ModuleMeta {
  id: number;
  name: string;
  timeHours: number;
  prerequisites: number[];
}

interface Props {
  subjectId: string;
  module: ModuleMeta;
  initialSectionID?: string;
  onStartQuiz: () => void;
  onPrevModule?: () => void;
  onNextModule?: () => void;
  hasPrevModule?: boolean;
  hasNextModule?: boolean;
  prevModuleName?: string;
  nextModuleName?: string;
}

function extractText(children: ReactNode): string {
  let text = "";
  const walk = (node: ReactNode) => {
    if (typeof node === "string") text += node;
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object" && "props" in node) {
      walk((node as { props: { children: ReactNode } }).props.children);
    }
  };
  walk(children);
  return text;
}

function headingId(children: ReactNode): string {
  return extractText(children)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[:,()]/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

const headingRenderer = (level: number) =>
  function Heading({ children }: { children?: ReactNode }) {
    const id = headingId(children);
    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    return <Tag id={id}>{children}</Tag>;
  };

const components = {
  h1: headingRenderer(1),
  h2: headingRenderer(2),
  h3: headingRenderer(3),
  h4: headingRenderer(4),
  h5: headingRenderer(5),
  h6: headingRenderer(6),
};

const THEME_LABELS: Record<Theme, string> = { dark: "Dark", sepia: "Sepia", light: "Light" };
const THEME_ICONS: Record<Theme, string> = { dark: "🌙", sepia: "📜", light: "☀️" };

const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: "#facc15",
  green: "#4ade80",
  blue: "#60a5fa",
  pink: "#f472b6",
};

export default function LessonView({ subjectId, module, initialSectionID, onStartQuiz, onPrevModule, onNextModule, hasPrevModule, hasNextModule, prevModuleName, nextModuleName }: Props) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [visibleSection, setVisibleSection] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [highlightSelection, setHighlightSelection] = useState<{ text: string; range: Range } | null>(null);
  const [highlightPickerPos, setHighlightPickerPos] = useState({ x: 0, y: 0 });

  const {
    bookmarks,
    handleToggleBookmark: toggleBookmark,
    handleDeleteBookmark,
    hasActiveBookmark,
  } = useBookmarks(subjectId, module.id, visibleSection);
  const { highlights, addHighlight, deleteHighlight } = useHighlights(subjectId, module.id);

  const [wideMode, setWideMode] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showSections, setShowSections] = useState(true);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const theme = useSettingsStore((s) => s.theme);
  const incFontSize = useSettingsStore((s) => s.incFontSize);
  const decFontSize = useSettingsStore((s) => s.decFontSize);
  const cycleTheme = useSettingsStore((s) => s.cycleTheme);

  useEffect(() => {
    setLoading(true);
    api.subjects.lesson(subjectId, module.id).then((lesson) => {
      setContent(lesson.content);
      setLoading(false);
    }).catch(() => setLoading(false));
    api.subjects.sections(subjectId, module.id).then(setSections).catch(() => {});
  }, [subjectId, module.id]);

  useEffect(() => {
    if (initialSectionID && content) {
      requestAnimationFrame(() => {
        scrollToSection(initialSectionID);
      });
    }
  }, [initialSectionID, content]);

  const handleToggleBookmark = useCallback(() => {
    const title = visibleSection
      ? `${module.name} – ${sections.find((s) => s.id === visibleSection)?.heading}`
      : module.name;
    toggleBookmark(title, visibleSection);
  }, [visibleSection, module.name, sections, toggleBookmark]);

  const handleToggleSectionBookmark = useCallback((sectionId: string, _hasBookmark: boolean, heading: string) => {
    toggleBookmark(`${module.name} – ${heading}`, sectionId);
  }, [module.name, toggleBookmark]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      setShowHighlightPicker(false);
      setHighlightSelection(null);
      return;
    }
    const text = selection.toString().trim();
    if (!text || text.length > 500) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setHighlightSelection({ text, range });
    setHighlightPickerPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    setShowHighlightPicker(true);
  };

  const handleAddHighlight = async (color: string) => {
    if (!highlightSelection) return;
    await addHighlight(highlightSelection.text, color);
    setShowHighlightPicker(false);
    setHighlightSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleScroll = () => {
    if (!contentRef.current || sections.length === 0) return;
    const headings = contentRef.current.querySelectorAll("h1, h2, h3, h4, h5, h6");
    let currentId: string | null = null;
    headings.forEach((h) => {
      const rect = h.getBoundingClientRect();
      if (rect.top < 150) currentId = h.id;
    });
    setVisibleSection(currentId);
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!contentRef.current) return;
    const container = contentRef.current;
    container.querySelectorAll('mark[data-highlight-id]').forEach((m) => {
      const parent = m.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(m.textContent || ''), m);
        parent.normalize();
      }
    });
    if (highlights.length === 0) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const marks: { node: Text; highlight: { id: string; selectedText: string; color: string } }[] = [];
    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      for (const h of highlights) {
        if (textNode.textContent?.includes(h.selectedText)) {
          marks.push({ node: textNode, highlight: h });
        }
      }
    }
    for (const { node, highlight } of marks) {
      const idx = node.textContent!.indexOf(highlight.selectedText);
      if (idx === -1) continue;
      const parent = node.parentElement;
      if (parent && (parent.tagName === 'MARK' || parent.closest('mark, pre, code'))) continue;
      const after = node.splitText(idx);
      after.splitText(highlight.selectedText.length);
      const mark = document.createElement('mark');
      mark.style.backgroundColor = HIGHLIGHT_COLORS[highlight.color] || highlight.color;
      mark.style.color = '#1f2937';
      mark.style.borderRadius = '2px';
      mark.style.padding = '0 2px';
      mark.dataset.highlightId = highlight.id;
      after.parentNode?.replaceChild(mark, after);
      mark.textContent = highlight.selectedText;
    }
  }, [highlights, content]);

  const hasPrevSection = sections.length > 0 && visibleSection !== null && sections.findIndex((s) => s.id === visibleSection) > 0;
  const hasNextSection = sections.length > 0 && visibleSection !== null && sections.findIndex((s) => s.id === visibleSection) < sections.length - 1;

  const scrollSection = (dir: "prev" | "next") => {
    if (!visibleSection) return;
    const idx = sections.findIndex((s) => s.id === visibleSection);
    const target = dir === "next" ? idx + 1 : idx - 1;
    if (target >= 0 && target < sections.length) scrollToSection(sections[target].id);
  };

  const currentSectionIdx = visibleSection ? sections.findIndex((s) => s.id === visibleSection) : -1;
  const prevSectionName = currentSectionIdx > 0 ? sections[currentSectionIdx - 1].heading : undefined;
  const nextSectionName = currentSectionIdx >= 0 && currentSectionIdx < sections.length - 1 ? sections[currentSectionIdx + 1].heading : undefined;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (showHighlightPicker) return;
      switch (e.key) {
        case "ArrowUp": e.preventDefault(); if (hasPrevSection) scrollSection("prev"); break;
        case "ArrowDown": e.preventDefault(); if (hasNextSection) scrollSection("next"); break;
        case "ArrowLeft": e.preventDefault(); if (hasPrevModule && onPrevModule) onPrevModule(); break;
        case "ArrowRight": e.preventDefault(); if (hasNextModule && onNextModule) onNextModule(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasPrevSection, hasNextSection, hasPrevModule, hasNextModule, onPrevModule, onNextModule, showHighlightPicker]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      if (absX > 40 && absX > absY * 1.5) {
        e.preventDefault();
        if (e.deltaX > 0 && hasNextModule && onNextModule) onNextModule();
        else if (e.deltaX < 0 && hasPrevModule && onPrevModule) onPrevModule();
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [hasPrevModule, hasNextModule, onPrevModule, onNextModule]);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading lesson...</div>;

  return (
    <div className="flex flex-1 overflow-hidden">
      {showTools && (
        <StudyTools
          subjectId={subjectId}
          moduleId={module.id}
          moduleName={module.name}
          sections={sections}
          visibleSection={visibleSection}
          content={content}
          onClose={() => setShowTools(false)}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-1.5 flex items-center gap-2 shrink-0">
          <button onClick={decFontSize} className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded" title="Decrease font size">A-</button>
          <span className="text-xs text-gray-400 w-8 text-center">{fontSize}</span>
          <button onClick={incFontSize} className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded" title="Increase font size">A+</button>
          <div className="h-3 w-px bg-gray-600" />
          <button onClick={cycleTheme} className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded" title={`Theme: ${THEME_LABELS[theme]}`}>
            {THEME_ICONS[theme]}
          </button>
          <div className="h-3 w-px bg-gray-600" />
          <button
            onClick={() => setWideMode(!wideMode)}
            className={toggleVariants({ active: wideMode })}
            title="Toggle wide mode"
          >
            {wideMode ? "Wide" : "Narrow"}
          </button>
          <div className="h-3 w-px bg-gray-600" />
          <button
            onClick={handleToggleBookmark}
            className={toggleVariants({ active: hasActiveBookmark })}
            title={visibleSection ? "Bookmark this section" : "Bookmark this module"}
          >
  {hasActiveBookmark ? "★" : "☆"} Bookmark
  </button>
  <div className="h-3 w-px bg-gray-600" />
  <button
    onClick={() => setShowTools(!showTools)}
    className={toggleVariants({ active: showTools })}
    title="Toggle study tools panel"
  >
    Tools
  </button>
  <button
    onClick={() => setShowSections(!showSections)}
    className={toggleVariants({ active: showSections })}
    title="Toggle sections panel"
  >
    Sections
  </button>
        </div>

        {/* Right-side floating panel: sections + nav */}
        {showSections && (
        <div className="relative h-0 z-50">
          <div className="absolute right-4 top-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl flex flex-col">
            {sections.length > 0 && (
              <>
                <div className="shrink-0 px-2.5 py-1.5 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-400">Sections</span>
                  <span className="text-[10px] text-gray-500">{sections.length}</span>
                </div>
                <div className="overflow-y-auto max-h-[280px]">
                  {sections.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => scrollToSection(s.id)}
                      className="w-full text-left px-2.5 py-1.5 text-xs transition-colors flex items-center gap-2"
                      style={s.id === visibleSection ? { backgroundColor: '#4f46e5', color: '#fff' } : { color: '#9ca3af', backgroundColor: 'transparent' }}
                      onMouseEnter={(e) => { if (s.id !== visibleSection) e.currentTarget.style.backgroundColor = '#374151'; }}
                      onMouseLeave={(e) => { if (s.id !== visibleSection) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <span className="shrink-0 w-5 text-right" style={s.id === visibleSection ? { color: '#a5b4fc' } : { color: '#6b7280' }}>{String(i + 1).padStart(2, "0")}</span>
                      <span className="truncate">{s.heading}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="flex justify-center py-3 px-2.5">
              <div className="bg-gray-800/50 rounded-xl p-2 flex flex-col items-center gap-1">
                <button
                  onClick={() => scrollSection("prev")}
                  disabled={!hasPrevSection}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl text-base font-mono font-bold transition-all duration-100 ${
                    hasPrevSection
                      ? "bg-gradient-to-b from-gray-600 to-gray-700 text-gray-100 border border-gray-500 border-b-[3px] shadow-md shadow-black/30 hover:from-indigo-500 hover:to-indigo-700 hover:border-indigo-400 hover:shadow-indigo-500/25 active:border-b active:mt-[3px] active:shadow-sm"
                      : "bg-gray-800 text-gray-600 border border-gray-700 border-b-[3px] cursor-not-allowed"
                  }`}
                  title="Previous section (↑)"
                >
                  ^
                </button>
              </div>
            </div>
          </div>
        </div>)}

        <div className="flex-1 overflow-y-auto p-6" ref={contentRef} onScroll={handleScroll} onMouseUp={handleTextSelection}>
          <div className={`book-content book-${theme}${wideMode ? " book-content-wide" : ""}`} style={{ fontSize: `${fontSize}px` }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={components}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {showHighlightPicker && highlightSelection && (
        <div
          className="fixed z-50 flex gap-1 bg-gray-800 border border-gray-600 rounded-lg p-1.5 shadow-xl"
          style={{ left: highlightPickerPos.x, top: highlightPickerPos.y, transform: "translate(-50%, -100%)" }}
        >
          {Object.entries(HIGHLIGHT_COLORS).map(([name, color]) => (
            <button
              key={name}
              onClick={() => handleAddHighlight(name)}
              className="w-6 h-6 rounded-full border-2 border-gray-600 hover:border-white transition-colors"
              style={{ backgroundColor: color }}
              title={name}
            />
          ))}
          <div className="w-px h-6 bg-gray-600 mx-1" />
          <button
            onClick={() => { setShowHighlightPicker(false); setHighlightSelection(null); window.getSelection()?.removeAllRanges(); }}
            className="w-6 h-6 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors flex items-center justify-center"
            title="Cancel highlight"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
