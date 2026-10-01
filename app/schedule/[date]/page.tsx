import { getDaySchedule, getFreeStaff } from "@/lib/schedule";
import ModernScheduleBoard from "@/components/ModernScheduleBoard";

// Reads live assignment/absence data on every load — without this, Next can
// treat the page as static and keep serving a snapshot from before someone's
// latest change (e.g. a just-created substitute scribe still showing as
// unassigned).
export const dynamic = "force-dynamic";

export default async function SchedulePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return <p className="text-red-600">Invalid date: {date}</p>;
  }

  const [day, freeStaff] = await Promise.all([getDaySchedule(date), getFreeStaff(date)]);

  // The title/date-nav row lives inside ModernScheduleBoard itself now —
  // it floats over the edge-to-edge Bethesda/Germantown split rather than
  // sitting above it in a separate bar, so the split can reach the true top
  // of the screen.
  if (day.weekday === null) {
    return (
      <p className="accent-border-soft rounded-2xl border-2 p-4 font-bold opacity-50">No clinic scheduled on weekends.</p>
    );
  }
  return <ModernScheduleBoard date={date} day={day} freeStaff={freeStaff} />;
}
