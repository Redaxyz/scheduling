import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffMonthCalendar } from "@/lib/calendar";
import { addMonths, calendarMonthOf, effectiveScheduleDate, firstOfMonth, formatMonthLabel, monthWeekdays } from "@/lib/date";
import { getWorkingHolidays } from "@/lib/workingHolidays";
import StaffCalendarGrid, { StaffLegend } from "@/components/StaffCalendarGrid";
import CalendarWhoToggle from "@/components/CalendarWhoToggle";
import MobileWeekRedirect from "@/components/MobileWeekRedirect";
import CalendarNavLinks from "@/components/CalendarNavLinks";
import MobileDateBar from "@/components/MobileDateBar";

// Reads live assignment/absence data on every load — see the note on
// app/schedule/[date]/page.tsx.
export const dynamic = "force-dynamic";

export default async function CalendarStaffMonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month: monthParam } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(monthParam)) {
    return <p className="text-red-600">Invalid month: {monthParam}</p>;
  }

  const month = firstOfMonth(monthParam);
  if (month !== monthParam) {
    redirect(`/calendar/staff/month/${month}`);
  }

  const dates = monthWeekdays(month);
  const [rows, workingHolidays] = await Promise.all([getStaffMonthCalendar(month), getWorkingHolidays(dates)]);
  const isThisMonth = month === calendarMonthOf(effectiveScheduleDate());

  return (
    <div className="relative left-1/2 w-bleed -translate-x-1/2">
      <MobileWeekRedirect who="staff" month={month} />
      <div className="mx-auto max-w-[1600px] space-y-1.5 px-4 sm:px-8">
        <MobileDateBar
          label={formatMonthLabel(month)}
          value={month}
          basePath="/calendar/staff/month/"
          snap="month"
          prevHref={`/calendar/staff/month/${addMonths(month, -1)}`}
          nextHref={`/calendar/staff/month/${addMonths(month, 1)}`}
          prevLabel="Previous month"
          nextLabel="Next month"
        />
        <div className="flex items-center justify-between gap-x-3">
          <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-base font-extrabold tracking-tight">
            {/* On a phone the date bar above the dock already shows this. */}
            <span className="phone:sr-only">{formatMonthLabel(month)}</span>
            {!isThisMonth && (
              <Link href={`/calendar/staff/month/${calendarMonthOf(effectiveScheduleDate())}`} className="accent-text text-xs font-bold hover:underline">
                Jump to this month
              </Link>
            )}
          </h1>
          <div className="flex shrink-0 items-center gap-2 phone:order-first unfolded:order-first">
            <CalendarWhoToggle who="staff" anchorDate={month} staffView="month" />
            <CalendarNavLinks
              prevHref={`/calendar/staff/month/${addMonths(month, -1)}`}
              nextHref={`/calendar/staff/month/${addMonths(month, 1)}`}
              prevLabel="Previous month"
              nextLabel="Next month"
            />
          </div>
        </div>

        <StaffLegend />

        <StaffCalendarGrid dates={dates} rows={rows} dense workingHolidays={[...workingHolidays]} />
      </div>
    </div>
  );
}
