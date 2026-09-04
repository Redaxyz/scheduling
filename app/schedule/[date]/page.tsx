import Link from "next/link";
import { getDaySchedule, getFreeStaff } from "@/lib/schedule";
import { formatLong, todayStr } from "@/lib/date";
import { WEEKDAY_LABELS } from "@/lib/types";
import ScheduleBoard from "@/components/ScheduleBoard";
import ScheduleDateNav from "@/components/ScheduleDateNav";

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
          <h1 className="text-xl font-extrabold tracking-tight">
            {day.weekday !== null ? WEEKDAY_LABELS[day.weekday] : "Weekend"} — {formatLong(date)}
          </h1>
          {!isToday && (
            <Link href={`/schedule/${todayStr()}`} className="accent-text text-sm font-bold hover:underline">
              Jump to today
            </Link>
          )}
        </div>
        <ScheduleDateNav date={date} />
      </div>

      {day.weekday === null ? (
        <p className="accent-border-soft rounded-2xl border-2 p-4 font-bold opacity-50">
          No clinic scheduled on weekends.
        </p>
      ) : (
        <ScheduleBoard date={date} day={day} freeStaff={freeStaff} />
      )}
    </div>
  );
}
