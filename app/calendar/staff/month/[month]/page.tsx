import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffMonthCalendar } from "@/lib/calendar";
import { addMonths, firstOfMonth, formatMonthLabel, monthWeekdays, todayStr } from "@/lib/date";
import StaffCalendarGrid from "@/components/StaffCalendarGrid";
import CalendarWhoToggle from "@/components/CalendarWhoToggle";
import CalendarNavLinks from "@/components/CalendarNavLinks";

export default async function CalendarStaffMonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month: monthParam } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(monthParam)) {
    return <p className="text-red-600">Invalid month: {monthParam}</p>;
  }

  const month = firstOfMonth(monthParam);
  if (month !== monthParam) {
    redirect(`/calendar/staff/month/${month}`);
  }

  const [rows, dates] = [await getStaffMonthCalendar(month), monthWeekdays(month)];
  const isThisMonth = month === firstOfMonth(todayStr());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">{formatMonthLabel(month)}</h1>
          <div className="flex flex-wrap gap-x-3 text-sm font-bold">
            {!isThisMonth && (
              <Link href={`/calendar/staff/month/${firstOfMonth(todayStr())}`} className="accent-text hover:underline">
                Jump to this month
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarWhoToggle who="staff" anchorDate={month} staffView="month" />
          <CalendarNavLinks
            prevHref={`/calendar/staff/month/${addMonths(month, -1)}`}
            nextHref={`/calendar/staff/month/${addMonths(month, 1)}`}
            prevLabel="Previous month"
            nextLabel="Next month"
          />
        </div>
      </div>

      <StaffCalendarGrid dates={dates} rows={rows} dense />
    </div>
  );
}
