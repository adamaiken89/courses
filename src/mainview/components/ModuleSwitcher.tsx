import { useState, useEffect, useRef } from "react";
import type { ModuleMeta } from "../../bun/types";

interface Props {
  modules: ModuleMeta[];
  currentModuleId: number;
  onSelect: (mod: ModuleMeta) => void;
}

export default function ModuleSwitcher({ modules, currentModuleId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentIdx = modules.findIndex((m) => m.id === currentModuleId);
  const current = modules[currentIdx];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2 min-w-[260px] w-full max-w-lg"
      >
        <span className="truncate">{current ? `${String(currentIdx + 1).padStart(2, "0")} ${current.name}` : "Modules"}</span>
        <span className={`text-xs shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-[60vh] overflow-y-auto">
          {modules.map((m, i) => (
            <button
              key={m.id}
              onClick={() => { onSelect(m); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                m.id === currentModuleId
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-5 text-xs text-gray-500 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-medium break-words min-w-0">{m.name}</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1 ml-7">
                {m.timeHours > 0 && (
                  <span className="text-[10px] text-gray-500">{m.timeHours}h</span>
                )}
                {m.topics && m.topics.length > 0 && m.topics.slice(0, 3).map((t, ti) => (
                  <span key={ti} className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
