import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import NotesTab from './study-tools/NotesTab';
import HighlightsTab from './study-tools/HighlightsTab';
import BookmarksTab from './study-tools/BookmarksTab';
import AITab from './study-tools/AITab';
import type { Section } from './sidebar-types';

type Tab = 'notes' | 'highlights' | 'bookmarks' | 'ask-ai';

interface StudyToolsProps {
  courseId: string;
  moduleId: number;
  moduleName: string;
  sections: Section[];
  visibleSection: string | null;
  content: string;
  onClose: () => void;
}

export default function StudyTools({
  courseId,
  moduleId,
  moduleName,
  sections,
  visibleSection,
  content,
  onClose,
}: StudyToolsProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('notes');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'notes', label: t('studyTools.notes') },
    { id: 'highlights', label: t('studyTools.highlights') },
    { id: 'bookmarks', label: t('studyTools.bookmarks') },
    { id: 'ask-ai', label: t('studyTools.askAi') },
  ];

  return (
    <aside className="w-72 bg-gray-850 border-r border-gray-700 flex flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-semibold text-indigo-400">{t('studyTools.title')}</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs">
          ✕
        </button>
      </div>
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-[10px] py-1.5 transition-colors ${
              activeTab === tab.id
                ? 'text-indigo-400 border-b-2 border-indigo-400 bg-gray-750'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'notes' && (
          <NotesTab
            courseId={courseId}
            moduleId={moduleId}
            sections={sections}
            visibleSection={visibleSection}
          />
        )}
        {activeTab === 'highlights' && <HighlightsTab courseId={courseId} moduleId={moduleId} />}
        {activeTab === 'bookmarks' && (
          <BookmarksTab
            courseId={courseId}
            moduleId={moduleId}
            moduleName={moduleName}
            sections={sections}
            visibleSection={visibleSection}
          />
        )}
        {activeTab === 'ask-ai' && <AITab content={content} />}
      </div>
    </aside>
  );
}
