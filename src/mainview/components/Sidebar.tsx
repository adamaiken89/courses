import { useState, useEffect } from "react";
import { api } from "../api";

export interface Section {
  id: string;
  heading: string;
  level: number;
  parentID: string | null;
}

export interface Note {
  id: string;
  subjectID: string;
  moduleID: number;
  highlightID: string | null;
  sectionID: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Highlight {
  id: string;
  subjectID: string;
  moduleID: number;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  color: string;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  subjectID: string;
  moduleID: number;
  sectionID: string | null;
  title: string;
  scrollPosition: number;
  createdAt: string;
}

interface SidebarProps {
  sections: Section[];
  visibleSection: string | null;
  highlights: Highlight[];
  bookmarks: Bookmark[];
  content: string;
  subjectId: string;
  moduleId: number;
  onScrollToSection: (id: string) => void;
  onDeleteHighlight: (id: string) => void;
  onToggleSectionBookmark: (sectionId: string, hasBookmark: boolean, heading: string) => void;
  onDeleteBookmark: (id: string) => void;
}

const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: "#facc15",
  green: "#4ade80",
  blue: "#60a5fa",
  pink: "#f472b6",
};

export default function Sidebar({
  sections, visibleSection, highlights, bookmarks,
  content, subjectId, moduleId,
  onScrollToSection,
  onDeleteHighlight, onToggleSectionBookmark, onDeleteBookmark,
}: SidebarProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [aiConversation, setAiConversation] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [aiThinking, setAiThinking] = useState(false);
  const [tab, setTab] = useState<"sections" | "notes" | "highlights" | "ai">("sections");
  const [noteInput, setNoteInput] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");

  useEffect(() => {
    api.storage.notes(subjectId, moduleId).then(setNotes).catch(() => setNotes([]));
  }, [subjectId, moduleId]);

  const handleAddNote = async () => {
    if (!noteInput.trim()) return;
    const note = await api.storage.addNote({
      subjectID: subjectId,
      moduleID: moduleId,
      content: noteInput.trim(),
      sectionID: visibleSection,
    });
    setNotes((prev) => [...prev, note]);
    setNoteInput("");
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    await api.storage.updateNote(id, editContent.trim());
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, content: editContent.trim(), updatedAt: new Date().toISOString() } : n
      )
    );
    setEditingNote(null);
    setEditContent("");
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setEditContent("");
  };

  const handleDeleteNote = async (id: string) => {
    await api.storage.deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleAskAI = async (question: string) => {
    if (!question.trim() || aiThinking) return;
    setAiConversation((prev) => [...prev, { role: "user", text: question }]);
    setAiThinking(true);
    try {
      const result = await api.gemini.ask(question, content.slice(0, 4000));
      setAiConversation((prev) => [...prev, { role: "ai", text: result.response }]);
    } catch (err) {
      setAiConversation((prev) => [...prev, { role: "ai", text: `Error: ${(err as Error).message}` }]);
    }
    setAiThinking(false);
  };

  const tabs = [
    { id: "sections" as const, label: "Sections", count: sections.length },
    { id: "notes" as const, label: "Notes", count: notes.length },
    { id: "highlights" as const, label: "Highlights", count: highlights.length },
    { id: "ai" as const, label: "Ask AI" },
  ];

  return (
    <aside className="w-64 bg-gray-850 border-l border-gray-700 overflow-y-auto shrink-0 flex flex-col">
      <div className="flex border-b border-gray-700 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-indigo-600/20 text-indigo-300 border-b-2 border-indigo-400"
                : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            }`}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "sections" && (
          <div>
            {sections.length === 0 && (
              <p className="text-xs text-gray-500">No sections found.</p>
            )}
            {sections.map((section) => {
              const bm = bookmarks.find((b) => b.sectionID === section.id);
              return (
                <div key={section.id} className="flex items-center group mb-0.5">
                  <button
                    onClick={() => onScrollToSection(section.id)}
                    className={`flex-1 text-left py-1 pr-1 text-xs rounded transition-colors ${
                      visibleSection === section.id
                        ? "bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-400"
                        : "text-gray-400 hover:text-gray-200 hover:bg-gray-800 border-l-2 border-transparent"
                    }`}
                    style={{ paddingLeft: `${12 + (section.level - 1) * 16}px` }}
                  >
                    {section.heading}
                  </button>
                  <button
                    onClick={() => {
                      if (bm) {
                        onDeleteBookmark(bm.id);
                      } else {
                        onToggleSectionBookmark(section.id, false, section.heading);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 px-1 text-xs text-gray-500 hover:text-amber-400 transition-all"
                    title={bm ? "Remove bookmark" : "Bookmark"}
                  >
                    {bm ? "★" : "☆"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === "notes" && (
          <div>
            <div className="flex gap-1.5 mb-3">
              <input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-indigo-500"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
              />
              <button
                onClick={handleAddNote}
                disabled={!noteInput.trim()}
                className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 rounded disabled:opacity-50 transition-colors"
              >
                Add
              </button>
            </div>

            {notes.length === 0 && (
              <p className="text-xs text-gray-500">No notes yet.</p>
            )}
            {notes.map((note) => (
              <div key={note.id} className="bg-gray-800 rounded p-2 mb-1.5 group">
                {editingNote === note.id ? (
                  <div className="flex flex-col gap-1">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded p-1.5 text-xs text-gray-200 resize-none h-16 outline-none focus:border-indigo-500"
                      autoFocus
                    />
                    <div className="flex gap-1 justify-end">
                      <button onClick={handleCancelEdit} className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-200">Cancel</button>
                      <button onClick={() => handleSaveEdit(note.id)} className="px-2 py-0.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded">Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-300 break-words whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-600">{new Date(note.createdAt).toLocaleDateString()}</p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditNote(note)} className="text-gray-500 hover:text-indigo-400 text-xs px-1" title="Edit">✎</button>
                        <button onClick={() => handleDeleteNote(note.id)} className="text-gray-500 hover:text-red-400 text-xs px-1" title="Delete">✕</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "highlights" && (
          <div>
            {highlights.length === 0 && (
              <p className="text-xs text-gray-500">
                No highlights yet. Select text in the lesson to highlight.
              </p>
            )}
            {highlights.map((h) => (
              <div key={h.id} className="bg-gray-800 rounded p-2 mb-1.5 group">
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-3 h-3 rounded-sm inline-block shrink-0"
                    style={{ backgroundColor: HIGHLIGHT_COLORS[h.color] || h.color }}
                  />
                  <p className="text-xs text-gray-400 flex-1 truncate">{h.selectedText}</p>
                  <button
                    onClick={() => onDeleteHighlight(h.id)}
                    className="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove highlight"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-gray-600">{new Date(h.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "ai" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto mb-2 space-y-2">
              {aiConversation.length === 0 && (
                <p className="text-xs text-gray-500">Ask a question about this lesson.</p>
              )}
              {aiConversation.map((msg, i) => (
                <div
                  key={i}
                  className={`p-2 rounded text-xs ${
                    msg.role === "user"
                      ? "bg-indigo-900/30 text-indigo-200 ml-4"
                      : "bg-gray-800 text-gray-300 mr-4"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              {aiThinking && (
                <div className="bg-gray-800 rounded p-2 text-xs text-gray-500 mr-4 animate-pulse">
                  Thinking...
                </div>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <textarea
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder="Ask about this lesson..."
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 resize-none h-12 outline-none focus:border-indigo-500"
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (aiQuestion.trim() && !aiThinking) {
                      handleAskAI(aiQuestion.trim());
                      setAiQuestion("");
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  if (aiQuestion.trim() && !aiThinking) {
                    handleAskAI(aiQuestion.trim());
                    setAiQuestion("");
                  }
                }}
                disabled={aiThinking || !aiQuestion.trim()}
                className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 rounded disabled:opacity-50 self-end transition-colors"
              >
                Ask
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
