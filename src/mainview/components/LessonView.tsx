import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { api } from "../api";
import { useSettingsStore } from "../stores/settingsStore";
import type { Theme } from "../stores/settingsStore";
import Sidebar, { type Section } from "./Sidebar";
import { useBookmarks } from "../hooks/useBookmarks";
import { useHighlights } from "../hooks/useHighlights";

interface ModuleMeta {
  id: number;
  name: string;
  timeHours: number;
  prerequisites: number[];
}

interface Props {
  subjectId: string;
  module: ModuleMeta;
  onStartQuiz: () => void;
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
  function Heading({ children }: { children: ReactNode }) {
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

const THEMES: Theme[] = ["dark", "sepia", "light"];
const THEME_LABELS: Record<Theme, string> = { dark: "Dark", sepia: "Sepia", light: "Light" };
const THEME_ICONS: Record<Theme, string> = { dark: "🌙", sepia: "📜", light: "☀️" };

const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: "#facc15",
  green: "#4ade80",
  blue: "#60a5fa",
  pink: "#f472b6",
};

export default function LessonView({ subjectId, module, onStartQuiz }: Props) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [visibleSection, setVisibleSection] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"sections" | "notes" | "highlights" | "ai" | null>(null);
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

  const scrollSection = (dir: "prev" | "next") => {
    if (!visibleSection) return;
    const idx = sections.findIndex((s) => s.id === visibleSection);
    const target = dir === "next" ? idx + 1 : idx - 1;
    if (target >= 0 && target < sections.length) scrollToSection(sections[target].id);
  };

  useEffect(() => {
    if (!contentRef.current || highlights.length === 0) return;
    const container = contentRef.current;
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

  if (loading) return <div className="p-8 text-center text-gray-400">Loading lesson...</div>;

  const hasPrevSection = sections.length > 0 && visibleSection !== null && sections.findIndex((s) => s.id === visibleSection) > 0;
  const hasNextSection = sections.length > 0 && visibleSection !== null && sections.findIndex((s) => s.id === visibleSection) < sections.length - 1;

  return (
    <div className="flex flex-1 overflow-hidden">
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
          <button onClick={() => scrollSection("prev")} disabled={!hasPrevSection} className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-30">↑ Sec</button>
          <button onClick={() => scrollSection("next")} disabled={!hasNextSection} className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-30">↓ Sec</button>
          <div className="h-3 w-px bg-gray-600" />
          <button
            onClick={() => setSidebarTab(sidebarTab ? null : "sections")}
            className={`px-2 py-0.5 text-xs rounded ${sidebarTab ? "bg-indigo-600 text-white" : "bg-gray-700 hover:bg-gray-600"}`}
          >
            Sidebar
          </button>
          <div className="h-3 w-px bg-gray-600" />
          <button
            onClick={handleToggleBookmark}
            className={`px-2 py-0.5 text-xs rounded ${
              hasActiveBookmark
                ? "bg-amber-600 text-white"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            title={visibleSection ? "Bookmark this section" : "Bookmark this module"}
          >
            {hasActiveBookmark ? "★" : "☆"} Bookmark
          </button>
          <div className="flex-1" />
          <button onClick={onStartQuiz} className="px-3 py-0.5 text-xs bg-emerald-700 hover:bg-emerald-600 rounded">
            Quiz
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto p-6"
          ref={contentRef}
          onScroll={handleScroll}
          onMouseUp={handleTextSelection}
        >
          <div className={`book-content book-${theme}`} style={{ fontSize: `${fontSize}px` }}>
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
        </div>
      )}

      {sidebarTab && (
        <Sidebar
          sections={sections}
          visibleSection={visibleSection}
          highlights={highlights}
          bookmarks={bookmarks}
          content={content}
          subjectId={subjectId}
          moduleId={module.id}
          onScrollToSection={scrollToSection}
          onDeleteHighlight={deleteHighlight}
          onToggleSectionBookmark={handleToggleSectionBookmark}
          onDeleteBookmark={handleDeleteBookmark}
        />
      )}
    </div>
  );
}
