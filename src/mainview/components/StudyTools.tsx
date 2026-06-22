import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useBookmarks } from "../hooks/useBookmarks";
import { useHighlights } from "../hooks/useHighlights";
import type { Section, Note } from "./sidebar-types";

type Tab = "notes" | "highlights" | "bookmarks" | "ask-ai";

interface StudyToolsProps {
  subjectId: string;
  moduleId: number;
  moduleName: string;
  sections: Section[];
  visibleSection: string | null;
  content: string;
  onClose: () => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "notes", label: "Notes" },
  { id: "highlights", label: "Highlights" },
  { id: "bookmarks", label: "Bookmarks" },
  { id: "ask-ai", label: "Ask AI" },
];

export default function StudyTools({
  subjectId, moduleId, moduleName, sections, visibleSection, content, onClose,
}: StudyToolsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("notes");
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const { bookmarks, loading: bmLoading, handleToggleBookmark, handleDeleteBookmark } =
    useBookmarks(subjectId, moduleId, visibleSection);
  const { highlights, loading: hlLoading, deleteHighlight } =
    useHighlights(subjectId, moduleId);

  const loadNotes = useCallback(() => {
    setNotesLoading(true);
    api.storage.notes(subjectId, moduleId)
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setNotesLoading(false));
  }, [subjectId, moduleId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    await api.storage.addNote({
      subjectID: subjectId,
      moduleID: moduleId,
      content: newNoteContent.trim(),
      sectionID: visibleSection,
    });
    setNewNoteContent("");
    loadNotes();
  };

  const handleUpdateNote = async (id: string) => {
    if (!editingContent.trim()) return;
    await api.storage.updateNote(id, editingContent.trim());
    setEditingNoteId(null);
    setEditingContent("");
    loadNotes();
  };

  const handleDeleteNote = async (id: string) => {
    await api.storage.deleteNote(id);
    loadNotes();
  };

  const handleAskAI = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiResponse("");
    try {
      const res = await api.gemini.ask(aiQuestion.trim(), content);
      setAiResponse(res.response);
    } catch {
      setAiResponse("Error: Check Gemini API key in Settings.");
    } finally {
      setAiLoading(false);
    }
  };

  const sectionOpt = visibleSection
    ? sections.find((s) => s.id === visibleSection)?.heading
    : null;

  return (
    <aside className="w-72 bg-gray-850 border-r border-gray-700 flex flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-semibold text-indigo-400">Study Tools</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
      </div>
      <div className="flex border-b border-gray-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 text-[10px] py-1.5 transition-colors ${
              activeTab === t.id
                ? "text-indigo-400 border-b-2 border-indigo-400 bg-gray-750"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === "notes" && (
          <div className="space-y-3">
            {sectionOpt && (
              <p className="text-[10px] text-gray-500 italic">
                Current section: {sectionOpt}
              </p>
            )}
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Add a note..."
              className="w-full bg-gray-800 border border-gray-600 rounded text-xs p-2 text-gray-200 placeholder-gray-500 resize-none h-20 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleAddNote}
              disabled={!newNoteContent.trim()}
              className="w-full py-1 text-xs bg-indigo-700 hover:bg-indigo-600 rounded disabled:opacity-40"
            >
              Save Note
            </button>
            {notesLoading ? (
              <p className="text-xs text-gray-500">Loading notes...</p>
            ) : notes.length === 0 ? (
              <p className="text-xs text-gray-500">No notes yet.</p>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="bg-gray-800 border border-gray-700 rounded p-2">
                  {editingNoteId === n.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded text-xs p-1.5 text-gray-200 resize-none h-16 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateNote(n.id)} className="flex-1 py-0.5 text-[10px] bg-indigo-700 hover:bg-indigo-600 rounded">Save</button>
                        <button onClick={() => { setEditingNoteId(null); setEditingContent(""); }} className="py-0.5 text-[10px] text-gray-400 hover:text-gray-200">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-300 whitespace-pre-wrap">{n.content}</p>
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={() => { setEditingNoteId(n.id); setEditingContent(n.content); }}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteNote(n.id)}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                      {n.sectionID && (
                        <p className="text-[10px] text-gray-600 mt-1">
                          Section: {sections.find((s) => s.id === n.sectionID)?.heading || n.sectionID}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "highlights" && (
          <div>
            {hlLoading ? (
              <p className="text-xs text-gray-500">Loading highlights...</p>
            ) : highlights.length === 0 ? (
              <p className="text-xs text-gray-500">No highlights yet. Select text to highlight.</p>
            ) : (
              highlights.map((h) => (
                <div key={h.id} className="bg-gray-800 border border-gray-700 rounded p-2 mb-2">
                  <p className="text-xs text-gray-300 line-clamp-2">{h.selectedText}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: h.color }} />
                    <button
                      onClick={() => deleteHighlight(h.id)}
                      className="text-[10px] text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "bookmarks" && (
          <div>
            {bmLoading ? (
              <p className="text-xs text-gray-500">Loading bookmarks...</p>
            ) : bookmarks.length === 0 ? (
              <p className="text-xs text-gray-500">No bookmarks yet.</p>
            ) : (
              bookmarks.map((b) => (
                <div key={b.id} className="bg-gray-800 border border-gray-700 rounded p-2 mb-2">
                  <p className="text-xs text-gray-300">{b.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {b.sectionID ? "Section" : "Module"}
                  </p>
                  <button
                    onClick={() => handleDeleteBookmark(b.id)}
                    className="text-[10px] text-red-400 hover:text-red-300 mt-1"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
            <button
              onClick={() => {
                const title = visibleSection
                  ? `${moduleName} – ${sectionOpt || ""}`
                  : moduleName;
                handleToggleBookmark(title, visibleSection);
              }}
              className="w-full py-1 text-xs bg-amber-700 hover:bg-amber-600 rounded mt-2"
            >
              {bookmarks.some((b) => visibleSection ? b.sectionID === visibleSection : !b.sectionID)
                ? "Remove Bookmark"
                : "Add Bookmark"}
            </button>
          </div>
        )}

        {activeTab === "ask-ai" && (
          <div className="space-y-3">
            <textarea
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              placeholder="Ask a question about this lesson..."
              className="w-full bg-gray-800 border border-gray-600 rounded text-xs p-2 text-gray-200 placeholder-gray-500 resize-none h-20 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleAskAI}
              disabled={!aiQuestion.trim() || aiLoading}
              className="w-full py-1 text-xs bg-indigo-700 hover:bg-indigo-600 rounded disabled:opacity-40"
            >
              {aiLoading ? "Thinking..." : "Ask"}
            </button>
            {aiResponse && (
              <div className="bg-gray-800 border border-gray-700 rounded p-2">
                <p className="text-xs text-gray-300 whitespace-pre-wrap">{aiResponse}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
