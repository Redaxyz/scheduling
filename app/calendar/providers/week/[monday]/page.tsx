import Link from "next/link";
import { redirect } from "next/navigation";
import { getProviderWeekCalendar } from "@/lib/calendar";
import { addDays, formatShort, mondayOf, todayStr, weekDates } from "@/lib/date";
import ProviderCalendarGrid from "@/components/ProviderCalendarGrid";
import CalendarWhoToggle from "@/components/CalendarWhoToggle";
import CalendarNavLinks from "@/components/CalendarNavLinks";

export default async function CalendarProvidersWeekPage({ params }: { params: Promise<{ monday: string }> }) {
  const { monday: mondayParam } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(mondayParam)) {
    return <p className="text-red-600">Invalid date: {mondayParam}</p>;
  }

  const monday = mondayOf(mondayParam);
  if (monday !== mondayParam) {
    redirect(`/calendar/providers/week/${monday}`);
  }

  const dates = weekDates(monday);
  const rows = await getProviderWeekCalendar(monday);
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
              <Link href={`/calendar/providers/week/${mondayOf(todayStr())}`} className="accent-text hover:underline">
                Jump to this week
              </Link>
            )}
            <Link href="/templates" className="opacity-50 hover:opacity-100">
              Edit weekly templates →
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarWhoToggle who="providers" anchorDate={monday} providersView="week" />
          <CalendarNavLinks
            prevHref={`/calendar/providers/week/${addDays(monday, -7)}`}
            nextHref={`/calendar/providers/week/${addDays(monday, 7)}`}
            prevLabel="Previous week"
            nextLabel="Next week"
          />
        </div>
      </div>

      <ProviderCalendarGrid dates={dates} rows={rows} dense={false} />
    </div>
  );
}
