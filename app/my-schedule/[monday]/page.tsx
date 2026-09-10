import Link from "next/link";
import { redirect } from "next/navigation";
import { getWeekScheduleForAllStaff } from "@/lib/schedule";
import { addDays, mondayOf, todayStr } from "@/lib/date";
import MyScheduleView from "@/components/MyScheduleView";
import AutoRefresh from "@/components/AutoRefresh";

export default async function MySchedulePage({ params }: { params: Promise<{ monday: string }> }) {
  const { monday: mondayParam } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(mondayParam)) {
    return <p className="text-red-600">Invalid date: {mondayParam}</p>;
  }

  const monday = mondayOf(mondayParam);
  if (monday !== mondayParam) {
    redirect(`/my-schedule/${monday}`);
  }

  const rows = await getWeekScheduleForAllStaff(monday);
  const isThisWeek = monday === mondayOf(todayStr());

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">My Schedule</h1>
          {!isThisWeek && (
            <Link href={`/my-schedule/${mondayOf(todayStr())}`} className="accent-text text-sm font-bold hover:underline">
              Jump to this week
            </Link>
          )}
        </div>
        <div className="flex gap-2 text-sm font-bold">
          <Link href={`/my-schedule/${addDays(monday, -7)}`} className="accent-border rounded-full border-2 px-4 py-1.5">
            ← Previous week
          </Link>
          <Link href={`/my-schedule/${addDays(monday, 7)}`} className="accent-border rounded-full border-2 px-4 py-1.5">
            Next week →
          </Link>
        </div>
      </div>

      <MyScheduleView rows={rows} />
    </div>
  );
}
