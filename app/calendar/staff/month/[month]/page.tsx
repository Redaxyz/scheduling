import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffMonthCalendar } from "@/lib/calendar";
import { addMonths, firstOfMonth, formatMonthLabel, monthWeekdays, todayStr } from "@/lib/date";
import StaffCalendarGrid from "@/components/StaffCalendarGrid";
import CalendarWhoToggle from "@/components/CalendarWhoToggle";

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
          <div className="flex gap-2 text-sm font-bold">
            <Link href={`/calendar/staff/month/${addMonths(month, -1)}`} className="accent-border rounded-full border-2 px-4 py-1.5">
              ← Previous month
            </Link>
            <Link href={`/calendar/staff/month/${addMonths(month, 1)}`} className="accent-border rounded-full border-2 px-4 py-1.5">
              Next month →
            </Link>
          </div>
        </div>
      </div>

      <StaffCalendarGrid dates={dates} rows={rows} dense />
    </div>
  );
}
