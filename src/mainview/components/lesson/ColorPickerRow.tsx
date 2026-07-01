import { HIGHLIGHT_COLORS } from '../rehypeHighlightText';

interface ColorPickerRowProps {
  activeHighlightColor?: string;
  onSelectColor: (color: string) => void;
  onDeleteHighlight?: () => void;
}

export function ColorPickerRow({
  activeHighlightColor,
  onSelectColor,
  onDeleteHighlight,
}: ColorPickerRowProps) {
  return (
    <div className="flex items-center justify-center gap-2 px-3 py-2">
      {Object.entries(HIGHLIGHT_COLORS)
        .filter(([name]) => name !== 'note')
        .map(([name, color]) => {
          const isActive = activeHighlightColor === name;
          return (
            <button
              key={name}
              onClick={() => (isActive ? onDeleteHighlight?.() : onSelectColor(name))}
              className={`w-5 h-5 rounded-full border transition-transform shrink-0 ${
                isActive
                  ? 'border-white scale-125 ring-1 ring-white'
                  : 'border-gray-500 hover:scale-125'
              }`}
              style={{ backgroundColor: color }}
              title={name}
            />
          );
        })}
    </div>
  );
}
