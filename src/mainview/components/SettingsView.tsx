import { useState, useEffect } from "react";
import { api } from "../api";
import { useSettingsStore } from "../stores/settingsStore";
import type { Theme } from "../themes";
interface ThemeCard {
  id: Theme;
  icon: string;
  label: string;
  desc: string;
}

const THEME_CARDS: ThemeCard[] = [
  { id: "dark", icon: "🌙", label: "Dark", desc: "Warm dark, easy on eyes at night" },
  { id: "oled", icon: "🖤", label: "OLED", desc: "Pure black for OLED screens" },
  { id: "nord", icon: "❄️", label: "Nord", desc: "Cool arctic tones, low strain" },
  { id: "sepia", icon: "📜", label: "Sepia", desc: "Paper-like, mimics physical book" },
  { id: "gruvbox", icon: "🪵", label: "Gruvbox", desc: "Warm retro, cozy alternative" },
  { id: "light", icon: "☀️", label: "Light", desc: "Crisp white for bright environments" },
  { id: "solarized-dark", icon: "🔆", label: "Solarized", desc: "Scientific amber, long sessions" },
  { id: "catppuccin", icon: "🩷", label: "Catppuccin", desc: "Pastel purple, gentle contrast" },
];

interface Props {
  onBack: () => void;
}

export default function SettingsView({ onBack }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const hasApiKey = useSettingsStore((s) => s.hasApiKey);
  const setHasApiKey = useSettingsStore((s) => s.setHasApiKey);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const incFontSize = useSettingsStore((s) => s.incFontSize);
  const decFontSize = useSettingsStore((s) => s.decFontSize);
  const wideMode = useSettingsStore((s) => s.wideMode);
  const setWideMode = useSettingsStore((s) => s.setWideMode);

  useEffect(() => {
    api.gemini.hasKey().then((r) => {
      setHasApiKey(r.hasKey);
    });
  }, [setHasApiKey]);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    await api.gemini.setKey(apiKey.trim());
    setHasApiKey(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col overflow-y-auto">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">← Back</button>
        <div className="h-4 w-px bg-gray-600" />
        <h2 className="text-sm font-medium">Settings</h2>
      </header>

      <main className="max-w-2xl mx-auto px-8 py-8 w-full flex-1">
        <section className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Gemini API Key</h3>
          <p className="text-sm text-gray-400 mb-4">
            Required for the Ask AI feature. Get a free key at{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" className="text-indigo-400 hover:underline" rel="noreferrer">
              Google AI Studio
            </a>
            .
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasApiKey ? "API key set (enter new key to change)" : "Enter your Gemini API key"}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500"
            />
            <button
              onClick={handleSaveKey}
              disabled={!apiKey.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {saved ? "Saved!" : "Save"}
            </button>
          </div>
          {hasApiKey && !saved && (
            <p className="text-xs text-emerald-400 mt-2">✓ API key is configured</p>
          )}
        </section>

        <section className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Reading Theme</h3>
          <div className="grid grid-cols-2 gap-3">
            {THEME_CARDS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`text-left p-3 rounded-xl border-2 transition-all ${
                  theme === t.id
                    ? "border-indigo-500 bg-indigo-900/30"
                    : "border-gray-700 bg-gray-800/50 hover:border-gray-500"
                }`}
              >
                <div className="text-base">{t.icon}</div>
                <div className="text-sm font-medium mt-1">{t.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{t.desc}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Font Size</h3>
          <div className="flex items-center gap-3">
            <button onClick={decFontSize} className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">A-</button>
            <input
              type="range"
              min={10}
              max={28}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="flex-1 accent-indigo-500"
            />
            <button onClick={incFontSize} className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">A+</button>
            <span className="text-sm text-gray-400 w-8 text-center">{fontSize}</span>
          </div>
        </section>

        <section className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Layout</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setWideMode(false)}
              className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                !wideMode
                  ? "border-indigo-500 bg-indigo-900/30"
                  : "border-gray-700 bg-gray-800/50 hover:border-gray-500"
              }`}
            >
              <div className="text-sm font-medium">Narrow</div>
              <div className="text-[10px] text-gray-400 mt-0.5">720px centered, book-like</div>
            </button>
            <button
              onClick={() => setWideMode(true)}
              className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                wideMode
                  ? "border-indigo-500 bg-indigo-900/30"
                  : "border-gray-700 bg-gray-800/50 hover:border-gray-500"
              }`}
            >
              <div className="text-sm font-medium">Wide</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Full width, max screen</div>
            </button>
          </div>
        </section>

        <section className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">About</h3>
          <p className="text-sm text-gray-400">CourseReader v1.0</p>
          <p className="text-sm text-gray-400">macOS desktop study app with spaced repetition.</p>
        </section>
      </main>
    </div>
  );
}
