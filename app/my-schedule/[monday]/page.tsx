import Link from "next/link";
import { redirect } from "next/navigation";
import { getWeekScheduleForAllStaff } from "@/lib/schedule";
import { addDays, effectiveMonday, formatShort, mondayOf } from "@/lib/date";
import ModernMyScheduleView from "@/components/ModernMyScheduleView";
import FullHeightFrame from "@/components/FullHeightFrame";
import AutoRefresh from "@/components/AutoRefresh";
import MyScheduleShell from "@/components/MyScheduleShell";
import CalendarNavLinks from "@/components/CalendarNavLinks";
import MobileDateBar from "@/components/MobileDateBar";
import MyScheduleHeading from "@/components/MyScheduleHeading";
import NotificationSetup from "@/components/NotificationSetup";

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
      <AutoRefresh stale={{ kind: "week", period: monday }} />
      <MobileDateBar
        label={`${formatShort(monday)} – ${formatShort(addDays(monday, 4))}`}
        value={monday}
        basePath="/my-schedule/"
        snap="week"
        prevHref={`/my-schedule/${addDays(monday, -7)}`}
        nextHref={`/my-schedule/${addDays(monday, 7)}`}
        prevLabel="Previous week"
        nextLabel="Next week"
      />
      <MyScheduleShell
        heading={
          <>
            <MyScheduleHeading />
            {!isThisWeek && (
              <Link href={`/my-schedule/${effectiveMonday()}`} className="accent-text text-xs font-bold hover:underline">
                Jump to this week
              </Link>
            )}
          </>
        }
        nav={
          <CalendarNavLinks
            prevHref={`/my-schedule/${addDays(monday, -7)}`}
            nextHref={`/my-schedule/${addDays(monday, 7)}`}
            prevLabel="Previous week"
            nextLabel="Next week"
          />
        }
      >
        <div className="relative left-1/2 w-bleed -translate-x-1/2">
          {/* Clipped top-to-bottom only, so a Germantown afternoon can run on
              into the iPhone Duo's side strip (.strip-dark-beside). */}
          <FullHeightFrame reserveBelow={72} heightScale={0.92} className="overflow-x-visible overflow-y-clip">
            <ModernMyScheduleView rows={rows} />
          </FullHeightFrame>
        </div>
      </MyScheduleShell>

      <NotificationSetup />
    </div>
  );
}
