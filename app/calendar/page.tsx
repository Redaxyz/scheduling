import { redirect } from "next/navigation";
import { firstOfMonth, todayStr } from "@/lib/date";

export default function CalendarIndex() {
  redirect(`/calendar/month/${firstOfMonth(todayStr())}`);
}
