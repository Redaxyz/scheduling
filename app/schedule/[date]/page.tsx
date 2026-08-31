import Link from "next/link";
import { getDaySchedule, getFreeStaff } from "@/lib/schedule";
import { addDays, formatLong, todayStr } from "@/lib/date";
import { WEEKDAY_LABELS } from "@/lib/types";
import ScheduleBoard from "@/components/ScheduleBoard";

export default async function SchedulePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return <p className="text-red-600">Invalid date: {date}</p>;
  }

  const [day, freeStaff] = await Promise.all([getDaySchedule(date), getFreeStaff(date)]);
  const isToday = date === todayStr();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {day.weekday !== null ? WEEKDAY_LABELS[day.weekday] : "Weekend"} — {formatLong(date)}
          </h1>
          {!isToday && (
            <Link href={`/schedule/${todayStr()}`} className="text-sm text-blue-700 hover:underline">
              Jump to today
            </Link>
          )}
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/schedule/${addDays(date, -1)}`}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50"
          >
            ← Previous day
          </Link>
          <Link
            href={`/schedule/${addDays(date, 1)}`}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50"
          >
            Next day →
          </Link>
        </div>
      </div>

      {day.weekday === null ? (
        <p className="rounded border border-slate-200 bg-white p-4 text-slate-500">
          No clinic scheduled on weekends.
        </p>
      ) : (
        <ScheduleBoard date={date} day={day} freeStaff={freeStaff} />
      )}
    </div>
  );
}
