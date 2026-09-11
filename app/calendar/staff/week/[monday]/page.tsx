import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffWeekCalendar } from "@/lib/calendar";
import { addDays, formatShort, mondayOf, todayStr, weekDates } from "@/lib/date";
import StaffCalendarGrid from "@/components/StaffCalendarGrid";
import CalendarWhoToggle from "@/components/CalendarWhoToggle";
import CalendarNavLinks from "@/components/CalendarNavLinks";

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
    <div className="space-y-3">
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
          <CalendarNavLinks
            prevHref={`/calendar/staff/week/${addDays(monday, -7)}`}
            nextHref={`/calendar/staff/week/${addDays(monday, 7)}`}
            prevLabel="Previous week"
            nextLabel="Next week"
          />
        </div>
      </div>

      <StaffCalendarGrid dates={dates} rows={rows} dense={false} />
    </div>
  );
}
