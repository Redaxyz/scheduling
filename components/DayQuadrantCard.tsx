import { QUADRANT_LAYOUT, type DayQuadrants, type QuadrantEntry } from "@/lib/calendar";
import { HALF_LABELS, type Half } from "@/lib/types";
import { formatShort } from "@/lib/date";

export default function DayQuadrantCard({
  day,
  onToggle,
}: {
  day: DayQuadrants;
  onToggle: (providerId: string, date: string, half: Half, entry: QuadrantEntry) => void;
}) {
  return (
    <div className="accent-border-soft rounded-2xl border-2 p-3 sm:p-4">
      <h3 className="mb-2 font-extrabold tracking-tight">
        {day.weekdayLabel} <span className="opacity-40">· {formatShort(day.date)}</span>
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {QUADRANT_LAYOUT.flat().map(({ office, half, label }) => (
          <div key={`${office}-${half}`} className="accent-border-soft rounded-xl border-2 p-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-40">
              {label} · {HALF_LABELS[half]}
            </div>
            {day.cells[office][half].length === 0 ? (
              <div className="text-sm font-bold opacity-25">—</div>
            ) : (
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                {day.cells[office][half].map((entry) => (
                  <button
                    key={entry.providerId}
                    onClick={() => onToggle(entry.providerId, day.date, half, entry)}
                    title={entry.present ? `Mark ${entry.name} absent` : `Mark ${entry.name} present`}
                    className={
                      entry.present
                        ? "text-base font-extrabold text-[#579669] sm:text-lg"
                        : "text-base font-normal text-slate-400 sm:text-lg"
                    }
                  >
                    {entry.initials}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
