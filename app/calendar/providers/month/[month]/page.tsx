import Link from "next/link";
import { redirect } from "next/navigation";
import { getProviderMonthCalendar } from "@/lib/calendar";
import { addMonths, firstOfMonth, formatMonthLabel, monthWeekdays, todayStr } from "@/lib/date";
import ProviderCalendarGrid from "@/components/ProviderCalendarGrid";
import CalendarWhoToggle from "@/components/CalendarWhoToggle";
import CalendarNavLinks from "@/components/CalendarNavLinks";

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
  const isThisMonth = month === firstOfMonth(todayStr());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">{formatMonthLabel(month)}</h1>
          <div className="flex flex-wrap gap-x-3 text-sm font-bold">
            {!isThisMonth && (
              <Link href={`/calendar/providers/month/${firstOfMonth(todayStr())}`} className="accent-text hover:underline">
                Jump to this month
              </Link>
            )}
            <Link href="/templates" className="opacity-50 hover:opacity-100">
              Edit weekly templates →
            </Link>
          </div>
        </div>
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

      <ProviderCalendarGrid dates={dates} rows={rows} dense />
    </div>
  );
}
