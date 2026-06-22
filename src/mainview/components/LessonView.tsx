import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

import { api } from '../api';
import { useBookmarks } from '../hooks/useBookmarks';
import { useHighlights } from '../hooks/useHighlights';
import { useSettingsStore } from '../stores/settingsStore';
import { THEME_TOKENS, themeToCSSVars } from '../themes';
import { Section } from './sidebar-types';
import { toggleVariants } from './ui';
import StudyTools from './StudyTools';
import type { ModuleMeta } from '../../../bun/types';

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

const THEME_LABELS: Record<Theme, string> = { dark: "Dark", oled: "OLED", nord: "Nord", sepia: "Sepia", gruvbox: "Gruvbox", light: "Light", "solarized-dark": "Solarized", catppuccin: "Catppuccin" };
const THEME_ICONS: Record<Theme, string> = { dark: "🌙", oled: "🖤", nord: "❄️", sepia: "📜", gruvbox: "🪵", light: "☀️", "solarized-dark": "🔆", catppuccin: "🩷" };

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

  const [showTools, setShowTools] = useState(false);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const theme = useSettingsStore((s) => s.theme);
  const wideMode = useSettingsStore((s) => s.wideMode);
  const setWideMode = useSettingsStore((s) => s.setWideMode);
  const showSections = useSettingsStore((s) => s.showSections);
  const toggleSections = useSettingsStore((s) => s.toggleSections);
  const incFontSize = useSettingsStore((s) => s.incFontSize);
  const decFontSize = useSettingsStore((s) => s.decFontSize);
  const cycleTheme = useSettingsStore((s) => s.cycleTheme);
  const themeVars = useMemo(() => themeToCSSVars(THEME_TOKENS[theme]), [theme]);

  useEffect(() => {
    setLoading(true);
    contentRef.current?.scrollTo(0, 0);
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

  const sectionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visibleSection || !sectionsRef.current) return;
    const el = sectionsRef.current.querySelector(`[data-section-id="${visibleSection}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [visibleSection]);

  const LEVEL_COLORS = ['#d1d5db', '#c7d2fe', '#bae6fd', '#d9f99d', '#fde68a', '#e9d5ff'];

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
    onClick={toggleSections}
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
                <div className="overflow-y-auto max-h-[70vh]" ref={sectionsRef}>
                  {sections.map((s) => {
                    const isActive = s.id === visibleSection;
                    const isBookmarked = bookmarks.some((b) => b.sectionID === s.id);
                    const levelColor = LEVEL_COLORS[Math.min(s.level - 1, 5)];
                    return (
                      <button
                        key={s.id}
                        data-section-id={s.id}
                        onClick={() => scrollToSection(s.id)}
                        className="w-full text-left px-2.5 py-0.5 text-xs transition-colors"
                        style={Object.assign(
                          { paddingLeft: `${(s.level - 1) * 16 + 10}px` },
                          isActive
                            ? { backgroundColor: '#4f46e5', color: '#fff' }
                            : { backgroundColor: 'transparent', color: levelColor }
                        )}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = '#374151'; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <div className="flex items-start gap-0.5" style={{ paddingRight: '2px' }}>
                          <span className="flex-1 whitespace-normal break-words min-w-0">{s.heading}</span>
                          <span
                            onClick={(e) => { e.stopPropagation(); handleToggleSectionBookmark(s.id, isBookmarked, s.heading); }}
                            className="shrink-0 cursor-pointer"
                            style={{ color: isBookmarked ? '#fbbf24' : isActive ? '#fff' : '#4b5563' }}
                            title={isBookmarked ? "Remove bookmark" : "Bookmark this section"}
                          >{isBookmarked ? '★' : '☆'}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>)}

        <div className="flex-1 overflow-y-auto p-6" ref={contentRef} onScroll={handleScroll} onMouseUp={handleTextSelection}>
          <div className={`book-content${wideMode ? " book-content-wide" : ""}`} style={{ fontSize: `${fontSize}px`, ...themeVars }}>
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
