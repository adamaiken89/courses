import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Highlight } from '../../../bun/types';
import { useLessonContext } from '../../sections/LessonContext';
import { useHighlightsStore } from '../../stores/highlightsStore';
import { useNotesStore } from '../../stores/notesStore';
import { showToast } from '../../toast';
import { findSectionIdForHighlight, scrollToHighlightEl } from './notes-helpers';

type MergedItem =
  | { kind: 'highlight'; highlight: Highlight }
  | {
      kind: 'note';
      note: {
        id: string;
        content: string;
        sectionID: string | null;
        highlightID: string | null;
        createdAt: string;
      };
      linkedHighlight?: Highlight;
    };

interface NotesHighlightsTabProps {
  courseId: string;
  moduleId: string;
}

export default function NotesHighlightsTab({ courseId, moduleId }: NotesHighlightsTabProps) {
  const { t } = useTranslation();
  const { contentRef, scrollToSection, sections, visibleSection } = useLessonContext();

  const loadNotes = useNotesStore((s) => s.load);
  const addNote = useNotesStore((s) => s.add);
  const updateNote = useNotesStore((s) => s.update);
  const removeNote = useNotesStore((s) => s.remove);
  const notesByModule = useNotesStore((s) => s.byModule);
  const notesLoading = useNotesStore((s) => s.loading[`${courseId}:${moduleId}`] ?? false);

  const highlightsByModule = useHighlightsStore((s) => s.byModule);
  const removeHighlight = useHighlightsStore((s) => s.remove);

  const k = `${courseId}:${moduleId}`;

  useEffect(() => {
    void loadNotes(courseId, moduleId);
  }, [courseId, moduleId, loadNotes]);

  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    await addNote({
      courseID: courseId,
      moduleID: moduleId,
      content: newNoteContent.trim(),
      sectionID: visibleSection ?? undefined,
    });
    setNewNoteContent('');
    showToast.success('toast.saved');
  };

  const handleUpdateNote = async (id: string) => {
    if (!editingContent.trim()) return;
    await updateNote(id, editingContent.trim());
    setEditingNoteId(null);
    setEditingContent('');
    showToast.success('toast.saved');
  };

  const handleDeleteNote = async (id: string) => {
    await removeNote(id);
    showToast.success('toast.deleted');
  };

  const handleDeleteHighlight = useCallback(
    async (id: string) => {
      await removeHighlight(id);
      showToast.success('toast.deleted');
    },
    [removeHighlight],
  );

  const mergedItems = useMemo<MergedItem[]>(() => {
    const notes = notesByModule[k] ?? [];
    const highlights = highlightsByModule[k] ?? [];
    const items: MergedItem[] = [];
    for (const h of highlights) {
      items.push({ kind: 'highlight', highlight: h });
    }
    for (const n of notes) {
      const linkedH = n.highlightID ? highlights.find((h) => h.id === n.highlightID) : undefined;
      items.push({ kind: 'note', note: n, linkedHighlight: linkedH });
    }
    items.sort((a, b) => {
      const aTime = a.kind === 'highlight' ? a.highlight.createdAt : a.note.createdAt;
      const bTime = b.kind === 'highlight' ? b.highlight.createdAt : b.note.createdAt;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
    return items;
  }, [notesByModule, highlightsByModule, k]);

  const handleNavigate = (item: MergedItem) => {
    if (item.kind === 'highlight') {
      scrollToHighlightEl(contentRef, item.highlight.id);
    } else {
      if (item.linkedHighlight) {
        const scrolled = scrollToHighlightEl(contentRef, item.linkedHighlight.id);
        if (scrolled) return;
      }
      if (item.note.sectionID) {
        scrollToSection(item.note.sectionID);
      }
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        value={newNoteContent}
        onChange={(e) => setNewNoteContent(e.target.value)}
        placeholder={t('studyTools.addNote')}
        className="w-full bg-gray-800 border border-gray-600 rounded text-xs p-2 text-gray-200 placeholder-gray-500 resize-none h-20 focus:outline-none focus:border-indigo-500"
      />
      <button
        onClick={() => {
          void handleAddNote();
        }}
        disabled={!newNoteContent.trim()}
        className="w-full py-1 text-xs bg-indigo-700 hover:bg-indigo-600 rounded disabled:opacity-40"
      >
        {t('studyTools.saveNote')}
      </button>
      {notesLoading ? (
        <p className="text-xs text-gray-500">{t('studyTools.loadingNotes')}</p>
      ) : mergedItems.length === 0 ? (
        <p className="text-xs text-gray-500">{t('studyTools.noNotesOrHighlights')}</p>
      ) : (
        mergedItems.map((item) => (
          <div
            key={item.kind === 'highlight' ? `h-${item.highlight.id}` : `n-${item.note.id}`}
            className="bg-gray-800 border border-gray-700 rounded p-2 cursor-pointer hover:bg-gray-750 transition-colors"
            onClick={() => handleNavigate(item)}
          >
            {item.kind === 'highlight' ? (
              <>
                <p className="text-xs text-gray-300 line-clamp-2">{item.highlight.selectedText}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.highlight.color }}
                  />
                  <span className="text-[10px] text-gray-500">
                    {item.highlight.startOffset}–{item.highlight.endOffset}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteHighlight(item.highlight.id);
                    }}
                    className="text-[10px] text-red-400 hover:text-red-300"
                  >
                    {t('common.delete')}
                  </button>
                </div>
                {(() => {
                  const sec = findSectionIdForHighlight(contentRef, item.highlight.id, sections);
                  return sec ? (
                    <p className="text-[10px] text-gray-600 mt-1">
                      {t('studyTools.section')} {sec.heading}
                    </p>
                  ) : null;
                })()}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full border-2 border-red-500 bg-white shrink-0" />
                  <span className="text-[10px] text-gray-400">{t('studyTools.notes')}</span>
                </div>
                {item.linkedHighlight && (
                  <p className="text-[10px] text-gray-600 italic mb-1 truncate border-l-2 border-gray-600 pl-1.5">
                    &ldquo;{item.linkedHighlight.selectedText.slice(0, 60)}
                    {item.linkedHighlight.selectedText.length > 60 ? '...' : ''}&rdquo;
                  </p>
                )}
                {editingNoteId === item.note.id ? (
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded text-xs p-1.5 text-gray-200 resize-none h-16 focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          void handleUpdateNote(item.note.id);
                        }}
                        className="flex-1 py-0.5 text-[10px] bg-indigo-700 hover:bg-indigo-600 rounded"
                      >
                        {t('common.save')}
                      </button>
                      <button
                        onClick={() => {
                          setEditingNoteId(null);
                          setEditingContent('');
                        }}
                        className="py-0.5 text-[10px] text-gray-400 hover:text-gray-200"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-300 whitespace-pre-wrap">{item.note.content}</p>
                    <div className="flex gap-2 mt-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setEditingNoteId(item.note.id);
                          setEditingContent(item.note.content);
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => {
                          void handleDeleteNote(item.note.id);
                        }}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </>
                )}
                {item.note.sectionID && (
                  <p className="text-[10px] text-gray-600 mt-1">
                    {t('studyTools.section')}{' '}
                    {sections.find((s) => s.id === item.note.sectionID)?.heading ??
                      item.note.sectionID}
                  </p>
                )}
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
