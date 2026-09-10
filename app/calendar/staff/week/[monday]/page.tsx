import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffWeekCalendar } from "@/lib/calendar";
import { addDays, formatShort, mondayOf, todayStr, weekDates } from "@/lib/date";
import StaffCalendarGrid from "@/components/StaffCalendarGrid";
import CalendarWhoToggle from "@/components/CalendarWhoToggle";

export default async function CalendarStaffWeekPage({ params }: { params: Promise<{ monday: string }> }) {
  const { monday: mondayParam } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(mondayParam)) {
    return <p className="text-red-600">Invalid date: {mondayParam}</p>;
  }

  const monday = mondayOf(mondayParam);
  if (monday !== mondayParam) {
    redirect(`/calendar/staff/week/${monday}`);
  }

  const dates = weekDates(monday);
  const rows = await getStaffWeekCalendar(monday);
  const isThisWeek = monday === mondayOf(todayStr());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">
            {formatShort(dates[0])} – {formatShort(dates[dates.length - 1])}
          </h1>
          <div className="flex flex-wrap gap-x-3 text-sm font-bold">
            {!isThisWeek && (
              <Link href={`/calendar/staff/week/${mondayOf(todayStr())}`} className="accent-text hover:underline">
                Jump to this week
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarWhoToggle who="staff" anchorDate={monday} staffView="week" />
          <div className="flex gap-2 text-sm font-bold">
            <Link href={`/calendar/staff/week/${addDays(monday, -7)}`} className="accent-border rounded-full border-2 px-4 py-1.5">
              ← Previous week
            </Link>
            <Link href={`/calendar/staff/week/${addDays(monday, 7)}`} className="accent-border rounded-full border-2 px-4 py-1.5">
              Next week →
            </Link>
          </div>
        </div>
      </div>

      <StaffCalendarGrid dates={dates} rows={rows} dense={false} />
    </div>
  );
}
