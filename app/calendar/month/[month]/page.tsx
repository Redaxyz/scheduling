import Link from "next/link";
import { redirect } from "next/navigation";
import { getMonthCalendar } from "@/lib/calendar";
import { addMonths, firstOfMonth, formatMonthLabel, todayStr } from "@/lib/date";
import CalendarBoard from "@/components/CalendarBoard";
import CalendarViewToggle from "@/components/CalendarViewToggle";

export default async function CalendarMonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month: monthParam } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(monthParam)) {
    return <p className="text-red-600">Invalid month: {monthParam}</p>;
  }

  const month = firstOfMonth(monthParam);
  if (month !== monthParam) {
    redirect(`/calendar/month/${month}`);
  }

  const days = await getMonthCalendar(month);
  const isThisMonth = month === firstOfMonth(todayStr());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">{formatMonthLabel(month)}</h1>
          <div className="flex flex-wrap gap-x-3 text-sm font-bold">
            {!isThisMonth && (
              <Link href={`/calendar/month/${firstOfMonth(todayStr())}`} className="accent-text hover:underline">
                Jump to this month
              </Link>
            )}
            <Link href="/templates" className="opacity-50 hover:opacity-100">
              Edit weekly templates →
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarViewToggle mode="month" anchorDate={month} />
          <div className="flex gap-2 text-sm font-bold">
            <Link href={`/calendar/month/${addMonths(month, -1)}`} className="accent-border rounded-full border-2 px-4 py-1.5">
              ← Previous month
            </Link>
            <Link href={`/calendar/month/${addMonths(month, 1)}`} className="accent-border rounded-full border-2 px-4 py-1.5">
              Next month →
            </Link>
          </div>
        </div>
      </div>

      <CalendarBoard days={days} compact />
    </div>
  );
}
