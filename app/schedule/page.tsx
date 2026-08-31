import { redirect } from "next/navigation";
import { todayStr } from "@/lib/date";

export default function ScheduleIndex() {
  redirect(`/schedule/${todayStr()}`);
}
