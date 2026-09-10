import { redirect } from "next/navigation";
import { firstOfMonth, todayStr } from "@/lib/date";

// No dynamic segment here, so without this Next.js prerenders the redirect
// once at build time and freezes whatever "this month" was that day — this
// page must recompute "today" on every request instead.
export const dynamic = "force-dynamic";

export default function CalendarIndex() {
  redirect(`/calendar/providers/month/${firstOfMonth(todayStr())}`);
}
