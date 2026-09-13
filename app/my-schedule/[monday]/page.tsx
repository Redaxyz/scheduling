import Link from "next/link";
import { redirect } from "next/navigation";
import { getWeekScheduleForAllStaff } from "@/lib/schedule";
import { addDays, effectiveMonday, mondayOf } from "@/lib/date";
import ModernMyScheduleView from "@/components/ModernMyScheduleView";
import FullHeightFrame from "@/components/FullHeightFrame";
import AutoRefresh from "@/components/AutoRefresh";
import MyTemplateEditor from "@/components/MyTemplateEditor";
import CalendarNavLinks from "@/components/CalendarNavLinks";
import MyScheduleHeading from "@/components/MyScheduleHeading";

// Reads live assignment/absence data on every load — see the note on
// app/schedule/[date]/page.tsx.
export const dynamic = "force-dynamic";

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
  const isThisWeek = monday === effectiveMonday();

  return (
    <div className="space-y-2">
      <AutoRefresh />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <MyScheduleHeading />
          {!isThisWeek && (
            <Link href={`/my-schedule/${effectiveMonday()}`} className="accent-text text-xs font-bold hover:underline">
              Jump to this week
            </Link>
          )}
        </div>
        <CalendarNavLinks
          prevHref={`/my-schedule/${addDays(monday, -7)}`}
          nextHref={`/my-schedule/${addDays(monday, 7)}`}
          prevLabel="Previous week"
          nextLabel="Next week"
        />
      </div>

      <div className="relative left-1/2 w-screen -translate-x-1/2">
        <FullHeightFrame reserveBelow={72} heightScale={0.92}>
          <ModernMyScheduleView rows={rows} />
        </FullHeightFrame>
      </div>

      <MyTemplateEditor />
    </div>
  );
}
