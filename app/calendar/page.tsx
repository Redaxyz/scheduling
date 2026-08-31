import { redirect } from "next/navigation";
import { mondayOf, todayStr } from "@/lib/date";

export default function CalendarIndex() {
  redirect(`/calendar/week/${mondayOf(todayStr())}`);
}
