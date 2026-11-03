import { redirect } from "next/navigation";
import { effectiveMonday } from "@/lib/date";

// No dynamic segment here, so without this Next.js prerenders the redirect
// once at build time and freezes whatever "this week" was that day — this
// page must recompute it on every request instead.
export const dynamic = "force-dynamic";

// Entering the Schedule tab always starts on the staff Week view; Month is
// one tap away on a computer.
export default function CalendarIndex() {
  redirect(`/calendar/staff/week/${effectiveMonday()}`);
}
