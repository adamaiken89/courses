import { DASHBOARD_DEFAULT_TEXT } from '../../colors';

interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  color?: string;
}

export function StatCard({ label, value, suffix, color }: StatCardProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: color ?? DASHBOARD_DEFAULT_TEXT }}>
        {value}
        {suffix && <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}
