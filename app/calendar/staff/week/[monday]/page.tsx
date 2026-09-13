import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffWeekCalendar } from "@/lib/calendar";
import { addDays, effectiveMonday, formatShort, mondayOf, weekDates } from "@/lib/date";
import StaffCalendarGrid, { StaffLegend } from "@/components/StaffCalendarGrid";
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
  const isThisWeek = monday === effectiveMonday();

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2">
      <div className="mx-auto max-w-[1600px] space-y-1.5 px-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h1 className="flex flex-wrap items-baseline gap-x-2 text-base font-extrabold tracking-tight">
            {formatShort(dates[0])} – {formatShort(dates[dates.length - 1])}
            {!isThisWeek && (
              <Link href={`/calendar/staff/week/${effectiveMonday()}`} className="accent-text text-xs font-bold hover:underline">
                Jump to this week
              </Link>
            )}
          </h1>
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

        <StaffLegend />

        <StaffCalendarGrid dates={dates} rows={rows} dense={false} />
      </div>
    </div>
  );
}
