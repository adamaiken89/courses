import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import type { Section, Note } from '../sidebar-types';

interface NotesTabProps {
  courseId: string;
  moduleId: number;
  sections: Section[];
  visibleSection: string | null;
}

export default function NotesTab({ courseId, moduleId, sections, visibleSection }: NotesTabProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const loadNotes = () => {
    return api.storage
      .notes(courseId, moduleId)
      .then(setNotes)
      .catch(() => setNotes([]));
  };

  useEffect(() => {
    setLoading(true);
    loadNotes().finally(() => setLoading(false));
  }, [courseId, moduleId]);

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    await api.storage.addNote({
      courseID: courseId,
      moduleID: moduleId,
      content: newNoteContent.trim(),
      sectionID: visibleSection ?? undefined,
    });
    setNewNoteContent('');
    loadNotes();
  };

  const handleUpdateNote = async (id: string) => {
    if (!editingContent.trim()) return;
    await api.storage.updateNote(id, editingContent.trim());
    setEditingNoteId(null);
    setEditingContent('');
    loadNotes();
  };

  const handleDeleteNote = async (id: string) => {
    await api.storage.deleteNote(id);
    loadNotes();
  };

  const sectionOpt = visibleSection ? sections.find((s) => s.id === visibleSection)?.heading : null;

  return (
    <div className="space-y-3">
      {sectionOpt && (
        <p className="text-[10px] text-gray-500 italic">
          {t('studyTools.currentSection', { section: sectionOpt })}
        </p>
      )}
      <textarea
        value={newNoteContent}
        onChange={(e) => setNewNoteContent(e.target.value)}
        placeholder={t('studyTools.addNote')}
        className="w-full bg-gray-800 border border-gray-600 rounded text-xs p-2 text-gray-200 placeholder-gray-500 resize-none h-20 focus:outline-none focus:border-indigo-500"
      />
      <button
        onClick={handleAddNote}
        disabled={!newNoteContent.trim()}
        className="w-full py-1 text-xs bg-indigo-700 hover:bg-indigo-600 rounded disabled:opacity-40"
      >
        {t('studyTools.saveNote')}
      </button>
      {loading ? (
        <p className="text-xs text-gray-500">{t('studyTools.loadingNotes')}</p>
      ) : notes.length === 0 ? (
        <p className="text-xs text-gray-500">{t('studyTools.noNotes')}</p>
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
                  <button
                    onClick={() => handleUpdateNote(n.id)}
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
                <p className="text-xs text-gray-300 whitespace-pre-wrap">{n.content}</p>
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={() => {
                      setEditingNoteId(n.id);
                      setEditingContent(n.content);
                    }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => handleDeleteNote(n.id)}
                    className="text-[10px] text-red-400 hover:text-red-300"
                  >
                    {t('common.delete')}
                  </button>
                </div>
                {n.sectionID && (
                  <p className="text-[10px] text-gray-600 mt-1">
                    {t('studyTools.section')}{' '}
                    {sections.find((s) => s.id === n.sectionID)?.heading || n.sectionID}
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
