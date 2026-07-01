import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import AITab from './studyTools/AITab';
import BookmarksTab from './studyTools/BookmarksTab';
import CardsTab from './studyTools/CardsTab';
import NotesHighlightsTab from './studyTools/NotesHighlightsTab';
import { Button } from './ui';

type Tab = 'notes-highlights' | 'bookmarks' | 'cards' | 'ask-ai';

interface StudyToolsProps {
  onClose: () => void;
}

export default function StudyTools({ onClose }: StudyToolsProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('notes-highlights');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'notes-highlights', label: t('studyTools.notesHighlights') },
    { id: 'bookmarks', label: t('studyTools.bookmarks') },
    { id: 'cards', label: t('studyTools.cards') },
    { id: 'ask-ai', label: t('studyTools.askAi') },
  ];

  return (
    <aside className="w-72 bg-gray-850 border-r border-gray-700 flex flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-semibold text-indigo-400">{t('studyTools.title')}</span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('icons.close')}
        </Button>
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
        {activeTab === 'notes-highlights' && <NotesHighlightsTab />}
        {activeTab === 'bookmarks' && <BookmarksTab />}
        {activeTab === 'cards' && <CardsTab />}
        {activeTab === 'ask-ai' && <AITab />}
      </div>
    </aside>
  );
}
