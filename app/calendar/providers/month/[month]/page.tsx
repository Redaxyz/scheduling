import Link from "next/link";
import { redirect } from "next/navigation";
import { getProviderMonthCalendar } from "@/lib/calendar";
import { addMonths, effectiveScheduleDate, firstOfMonth, formatMonthLabel, monthWeekdays } from "@/lib/date";
import ProviderCalendarGrid, { ProviderLegend } from "@/components/ProviderCalendarGrid";
import CalendarWhoToggle from "@/components/CalendarWhoToggle";
import CalendarNavLinks from "@/components/CalendarNavLinks";

// Reads live assignment/absence data on every load — see the note on
// app/schedule/[date]/page.tsx.
export const dynamic = "force-dynamic";

export default async function CalendarProvidersMonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month: monthParam } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(monthParam)) {
    return <p className="text-red-600">Invalid month: {monthParam}</p>;
  }

  const month = firstOfMonth(monthParam);
  if (month !== monthParam) {
    redirect(`/calendar/providers/month/${month}`);
  }

  const [rows, dates] = [await getProviderMonthCalendar(month), monthWeekdays(month)];
  const isThisMonth = month === firstOfMonth(effectiveScheduleDate());

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2">
      <div className="mx-auto max-w-[1600px] space-y-1.5 px-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h1 className="flex flex-wrap items-baseline gap-x-2 text-base font-extrabold tracking-tight">
            {formatMonthLabel(month)}
            {!isThisMonth && (
              <Link href={`/calendar/providers/month/${firstOfMonth(effectiveScheduleDate())}`} className="accent-text text-xs font-bold hover:underline">
                Jump to this month
              </Link>
            )}
            <Link href="/templates" className="text-xs font-bold opacity-50 hover:opacity-100">
              Edit weekly templates →
            </Link>
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarWhoToggle who="providers" anchorDate={month} providersView="month" />
            <CalendarNavLinks
              prevHref={`/calendar/providers/month/${addMonths(month, -1)}`}
              nextHref={`/calendar/providers/month/${addMonths(month, 1)}`}
              prevLabel="Previous month"
              nextLabel="Next month"
            />
          </div>
        </div>

        <ProviderLegend />

        <ProviderCalendarGrid dates={dates} rows={rows} dense />
      </div>
    </div>
  );
}
