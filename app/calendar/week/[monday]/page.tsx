import Link from "next/link";
import { redirect } from "next/navigation";
import { getWeekCalendar } from "@/lib/calendar";
import { addDays, formatShort, mondayOf, todayStr } from "@/lib/date";
import CalendarBoard from "@/components/CalendarBoard";
import CalendarViewToggle from "@/components/CalendarViewToggle";

export default async function CalendarWeekPage({ params }: { params: Promise<{ monday: string }> }) {
  const { monday: mondayParam } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(mondayParam)) {
    return <p className="text-red-600">Invalid week: {mondayParam}</p>;
  }

  const monday = mondayOf(mondayParam);
  if (monday !== mondayParam) {
    redirect(`/calendar/week/${monday}`);
  }

  const days = await getWeekCalendar(monday);
  const isThisWeek = monday === mondayOf(todayStr());
  const friday = addDays(monday, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">
            Week of {formatShort(monday)} – {formatShort(friday)}
          </h1>
          <div className="flex flex-wrap gap-x-3 text-sm font-bold">
            {!isThisWeek && (
              <Link href={`/calendar/week/${mondayOf(todayStr())}`} className="accent-text hover:underline">
                Jump to this week
              </Link>
            )}
            <Link href="/templates" className="opacity-50 hover:opacity-100">
              Edit weekly templates →
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarViewToggle mode="week" anchorDate={monday} />
          <div className="flex gap-2 text-sm font-bold">
            <Link href={`/calendar/week/${addDays(monday, -7)}`} className="accent-border rounded-full border-2 px-4 py-1.5">
              ← Previous week
            </Link>
            <Link href={`/calendar/week/${addDays(monday, 7)}`} className="accent-border rounded-full border-2 px-4 py-1.5">
              Next week →
            </Link>
          </div>
        </div>
      </div>

      <CalendarBoard days={days} />
    </div>
  );
}
