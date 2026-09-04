import type { StaffMonthRow, StaffDayStatus } from "@/lib/calendar";
import { weekdayIndex } from "@/lib/date";

const STATUS_COLOR: Record<StaffDayStatus, string> = {
  PRESENT: "#579669",
  ABSENT: "#dc2626",
  PARTIAL: "#d97706",
};

const STATUS_LABEL: Record<StaffDayStatus, string> = {
  PRESENT: "present",
  ABSENT: "absent",
  PARTIAL: "partial / running late",
};

const WEEKDAY_LETTERS = ["M", "T", "W", "R", "F"];

export default function StaffMonthGrid({ dates, rows }: { dates: string[]; rows: StaffMonthRow[] }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold opacity-60">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: STATUS_COLOR.PRESENT }} /> Present
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: STATUS_COLOR.ABSENT }} /> Absent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: STATUS_COLOR.PARTIAL }} /> Partial / running late
        </span>
      </div>

      <div className="accent-border-soft overflow-x-auto rounded-2xl border-2">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="accent-border-soft sticky left-0 z-10 border-b-2 border-r-2 bg-white px-3 py-2 text-left font-extrabold tracking-tight">
                Staff
              </th>
              {dates.map((date) => {
                const day = Number(date.slice(-2));
                const wd = weekdayIndex(date)!;
                return (
                  <th key={date} className="accent-border-soft min-w-[28px] border-b-2 px-1 py-2 text-center text-[10px] font-bold opacity-50">
                    <div>{WEEKDAY_LETTERS[wd]}</div>
                    <div>{day}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.staffId}>
                <td className="accent-border-soft sticky left-0 z-10 whitespace-nowrap border-r-2 bg-white px-3 py-1.5 font-bold">
                  {row.name}
                </td>
                {dates.map((date) => (
                  <td key={date} className="p-1 text-center">
                    <span
                      className="inline-block h-5 w-5 rounded"
                      style={{ background: STATUS_COLOR[row.days[date]] }}
                      title={`${row.name} — ${date}: ${STATUS_LABEL[row.days[date]]}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
