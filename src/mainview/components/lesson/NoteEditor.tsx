import { useTranslation } from 'react-i18next';

interface NoteEditorProps {
  selectedText: string;
  noteText: string;
  x: number;
  y: number;
  onChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function NoteEditor({
  selectedText,
  noteText,
  x,
  y,
  onChange,
  onSave,
  onCancel,
}: NoteEditorProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="note-editor"
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl"
      style={{
        left: x,
        top: y - 120,
        transform: 'translate(-50%, 0)',
        width: '280px',
      }}
    >
      <p className="text-[10px] text-gray-500 mb-1.5 truncate">
        &ldquo;{selectedText.slice(0, 80)}
        {selectedText.length > 80 ? '...' : ''}&rdquo;
      </p>
      <textarea
        value={noteText}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('studyTools.addNote')}
        className="w-full bg-gray-700 border border-gray-600 rounded text-xs p-2 text-gray-200 placeholder-gray-500 resize-none h-16 focus:outline-none focus:border-indigo-500"
        autoFocus
      />
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={onSave}
          disabled={!noteText.trim()}
          className="flex-1 py-1 text-[10px] bg-indigo-700 hover:bg-indigo-600 rounded disabled:opacity-40"
        >
          {t('studyTools.saveNote')}
        </button>
        <button onClick={onCancel} className="py-1 text-[10px] text-gray-400 hover:text-gray-200">
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
