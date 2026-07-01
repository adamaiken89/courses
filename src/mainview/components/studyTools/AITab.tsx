import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../api';
import { showToast } from '../../toast';

interface AITabProps {
  content: string;
}

export default function AITab({ content }: AITabProps) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setResponse('');
    try {
      const res = await api.gemini.ask(question.trim(), content);
      setResponse(res.response);
    } catch {
      showToast.error('toast.aiFailed');
      setResponse(t('studyTools.aiError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={t('studyTools.askQuestion')}
        className="w-full bg-gray-800 border border-gray-600 rounded text-xs p-2 text-gray-200 placeholder-gray-500 resize-none h-20 focus:outline-none focus:border-indigo-500"
      />
      <button
        onClick={() => {
          void handleAsk();
        }}
        disabled={!question.trim() || loading}
        className="w-full py-1 text-xs bg-indigo-700 hover:bg-indigo-600 rounded disabled:opacity-40"
      >
        {loading ? t('studyTools.thinking') : t('studyTools.ask')}
      </button>
      {response && (
        <div className="bg-gray-800 border border-gray-700 rounded p-2">
          <p className="text-xs text-gray-300 whitespace-pre-wrap">{response}</p>
        </div>
      )}
    </div>
  );
}
